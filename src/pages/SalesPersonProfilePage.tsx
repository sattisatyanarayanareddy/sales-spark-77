import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile, uploadProfilePicture } from "@/lib/firestore-service";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SalesPersonProfilePage: React.FC = () => {
  const { crmUser, setCrmUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: crmUser?.name || "",
    email: crmUser?.email || "",
    phone: crmUser?.phone || "",
    address: crmUser?.address || "",
    department: crmUser?.department || "",
    designation: crmUser?.designation || "",
    companyName: crmUser?.companyName || "",
  });
  const [profilePicture, setProfilePicture] = useState<string | null>(crmUser?.profilePicture || null);
  const [signature, setSignature] = useState<string | null>(crmUser?.signature || null);
  const [signatureMode, setSignatureMode] = useState<"draw" | "upload">("draw");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [sigError, setSigError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (crmUser) {
      setFormData({
        name: crmUser.name || "",
        email: crmUser.email || "",
        phone: crmUser.phone || "",
        address: crmUser.address || "",
        department: crmUser.department || "",
        designation: crmUser.designation || "",
        companyName: crmUser.companyName || "",
      });
      setProfilePicture(crmUser.profilePicture || null);
      setSignature(crmUser.signature || null);
    }
  }, [crmUser]);

  if (!crmUser) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError("");

    // Check file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > 3) {
      setFileError("File size must be less than 3MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setFileError("Please upload an image file");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setProfilePicture(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigError("");

    if (file.size / (1024 * 1024) > 2) {
      setSigError("Signature size must be less than 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSigError("Please upload an image file");
      return;
    }

    setSignatureFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSignature(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.clientX - rect.left;
      y = e.nativeEvent.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.clientX - rect.left;
      y = e.nativeEvent.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasFile = async (): Promise<File | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Check if the canvas is blank
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      return null;
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `signature-${crmUser.id}.png`, { type: "image/png" });
          resolve(file);
        } else {
          resolve(null);
        }
      }, "image/png");
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.designation || !formData.companyName) {
      toast.error("Name, email, designation, and company name are required");
      return;
    }

    setLoading(true);
    try {
      let profilePictureUrl = profilePicture;
      let finalSignatureUrl = signature;

      // Upload profile picture if changed and is a blob
      if (profilePicture && profilePicture.startsWith("data:")) {
        profilePictureUrl = await uploadProfilePicture(crmUser.id, profilePicture);
      }

      // Handle signature upload if changed
      if (signatureMode === "draw") {
        const drawnFile = await getCanvasFile();
        if (drawnFile) {
          finalSignatureUrl = await uploadImageToCloudinary(drawnFile, "signatures");
        }
      } else if (signatureMode === "upload" && signatureFile) {
        finalSignatureUrl = await uploadImageToCloudinary(signatureFile, "signatures");
      }

      // Update user profile
      await updateUserProfile(crmUser.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        department: formData.department,
        designation: formData.designation,
        companyName: formData.companyName,
        profilePicture: profilePictureUrl,
        signature: finalSignatureUrl || "",
        updatedAt: new Date().toISOString(),
      });

      // Update local context
      if (setCrmUser) {
        setCrmUser({
          ...crmUser,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          department: formData.department,
          designation: formData.designation,
          companyName: formData.companyName,
          profilePicture: profilePictureUrl,
          signature: finalSignatureUrl || "",
          updatedAt: new Date().toISOString(),
        });
      }

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal information and profile picture</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Upload a profile picture (Max 3MB)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <div className="text-4xl mb-1">📷</div>
                    <div className="text-xs">No photo</div>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Photo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WebP. Max 3MB.
                </p>
                {fileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{fileError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="Enter your department"
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  placeholder="Enter your company name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation *</Label>
                <Input
                  id="designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                  placeholder="e.g. Sales Executive, Manager"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter your address"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signature</CardTitle>
            <CardDescription>Draw or upload your signature to be displayed on quotations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 p-1 bg-muted rounded-lg max-w-[280px]">
              <button
                type="button"
                onClick={() => setSignatureMode("draw")}
                className={cn(
                  "flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition-all",
                  signatureMode === "draw" ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setSignatureMode("upload")}
                className={cn(
                  "flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition-all",
                  signatureMode === "upload" ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Upload Image
              </button>
            </div>

            {signatureMode === "draw" ? (
              <div className="space-y-2">
                <Label>Draw your signature inside the box below</Label>
                <div className="relative border-2 border-dashed border-border rounded-lg bg-white overflow-hidden max-w-[450px]">
                  <canvas
                    ref={canvasRef}
                    width={450}
                    height={150}
                    className="cursor-crosshair w-full block bg-white"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearSignatureCanvas} className="h-8 text-xs">
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signatureInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Signature Image
                </Button>
                <p className="text-xs text-muted-foreground">
                  Upload a PNG, JPG or WebP image. Transparent PNG is highly recommended. Max 2MB.
                </p>
                {sigError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{sigError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {signature && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <Label>Signature Preview</Label>
                <div className="w-48 h-20 bg-muted/30 border rounded-lg flex items-center justify-center p-2 overflow-hidden bg-white">
                  <img src={signature} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button
            size="lg"
            onClick={handleSave}
            disabled={loading}
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalesPersonProfilePage;