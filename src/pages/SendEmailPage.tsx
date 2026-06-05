import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchQuotationById,
  updateQuotationDoc,
  exportQuotationToPDF,
} from "@/lib/firestore-service";
import { Quotation } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import StageBadge from "@/components/StageBadge";

const SendEmailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { crmUser } = useAuth();
  const navigate = useNavigate();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadQuotation = async () => {
      if (!id || !crmUser) return;
      setLoading(true);
      try {
        const q = await fetchQuotationById(id);
        if (!q) {
          toast.error("Quotation not found");
          navigate("/quotations");
          return;
        }
        if (q.status !== "Approved") {
          toast.error("This quotation is not approved yet");
          navigate("/quotations");
          return;
        }
        setQuotation(q);
        setEmailTo(q.customerEmail || "");
        setEmailCc("");
        setEmailSubject(`Sales Quotation ${q.quotationNumber} from ${crmUser.name}`);
        setEmailBody(
          `Dear ${q.customerName},\n\nPlease find attached our quotation ${q.quotationNumber} for ${q.companyName}. We hope this proposal meets your requirements. If you have any questions or need any changes, please let us know.\n\nBest regards,\n${crmUser.name}${crmUser.designation ? `\n${crmUser.designation}` : ""}${crmUser.companyName ? `\n${crmUser.companyName}` : ""}`
        );
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load quotation");
        navigate("/quotations");
      } finally {
        setLoading(false);
      }
    };
    loadQuotation();
  }, [id, crmUser, navigate]);

  const handleDownloadPDF = async () => {
    if (!quotation) return;
    setDownloadingPDF(true);
    try {
      await exportQuotationToPDF(quotation);
      toast.success("PDF downloaded successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleSendEmail = async () => {
    if (!quotation) return;
    if (!emailTo.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }

    setSaving(true);
    try {
      // Generate the PDF using the same client-side template and get base64
      const pdfBase64 = await exportQuotationToPDF(quotation, true);

      const response = await fetch("/api/send-quotation-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotation,
          to: emailTo,
          cc: emailCc,
          subject: emailSubject,
          body: emailBody,
          pdfBase64,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = "Failed to send email";
        try {
          const errorData = JSON.parse(text || "{}");
          errorMessage = errorData?.message || errorMessage;
        } catch {
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      await updateQuotationDoc(quotation.id, { status: "Sent Mail" });
      setQuotation({ ...quotation, status: "Sent Mail" });
      toast.success("Quotation email sent successfully and status marked Sent Mail.");
      navigate("/quotations");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to send email");
    } finally {
      setSaving(false);
    }
  };

  if (!crmUser) return null;

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Quotation not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="dashboard-hero p-5 md:p-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/quotations")}
            className="h-10 w-10 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="section-title">Send Quotation Email</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {quotation.quotationNumber} · {quotation.customerName}
            </p>
          </div>
          <StageBadge stage={quotation.status} />
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-panel p-6 max-w-3xl">
        <div className="space-y-6">
          {/* Quotation Summary */}
          <div className="border-b border-border/50 pb-6">
            <h3 className="font-semibold mb-4">Quotation Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Number</p>
                <p className="font-mono font-semibold mt-1">{quotation.quotationNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Customer</p>
                <p className="font-medium mt-1">{quotation.customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Value</p>
                <p className="font-bold text-primary mt-1">${quotation.totalValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Status</p>
                <div className="mt-1">
                  <StageBadge stage={quotation.status} />
                </div>
              </div>
            </div>
          </div>

          {/* Email Draft Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Email Draft</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email-to" className="font-semibold">To *</Label>
                <Input
                  id="email-to"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="customer@example.com"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Customer email address</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-cc" className="font-semibold">CC</Label>
                <Input
                  id="email-cc"
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  placeholder="sales@example.com, manager@example.com"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Optional: additional recipients</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-subject" className="font-semibold">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-body" className="font-semibold">Message</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
                disabled={saving}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={downloadingPDF || saving}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloadingPDF ? "Generating PDF..." : "Download PDF"}
            </Button>
            <Button
              onClick={() => setShowPreview(true)}
              variant="outline"
              disabled={saving}
              className="flex-1"
            >
              Preview Email
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={saving || !emailTo.trim()}
              className="flex-1 btn-gradient"
            >
              {saving ? "Sending..." : "Send Email & Mark as Sent"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/quotations")}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 font-mono">
              <div>
                <span className="font-semibold text-muted-foreground">From:</span> {crmUser.email}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">To:</span> {emailTo || "(not set)"}
              </div>
              {emailCc && (
                <div>
                  <span className="font-semibold text-muted-foreground">CC:</span> {emailCc}
                </div>
              )}
              <div>
                <span className="font-semibold text-muted-foreground">Subject:</span> {emailSubject}
              </div>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg whitespace-pre-wrap text-xs font-mono">
              {emailBody}
            </div>
            <div className="text-xs text-muted-foreground italic">
              Note: The PDF will be attached when you open your email client.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SendEmailPage;
