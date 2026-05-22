import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  fetchQuotationById,
  approveQuotationDoc,
  rejectQuotationDoc,
  exportQuotationToPDF,
} from "@/lib/firestore-service";
import { AppNotification, Quotation } from "@/types/crm";
import {
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  ImageOff,
  ExternalLink,
  Download,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StageBadge from "@/components/StageBadge";
import { toast } from "sonner";

function formatRelativeTime(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  if (isNaN(diffMs) || diffMs < 0) return "Just now";
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "Just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const NotificationBell: React.FC = () => {
  const { crmUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeNotification, setActiveNotification] = useState<AppNotification | null>(null);
  const [viewingQuotationOpen, setViewingQuotationOpen] = useState(false);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!crmUser) return;

    console.log("🔔 Subscribing to notifications for user:", crmUser.id);
    const unsubscribe = subscribeNotifications(crmUser.id, crmUser.role, (data) => {
      setNotifications(data);
    });

    return () => {
      unsubscribe();
    };
  }, [crmUser]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!crmUser) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead(crmUser.id, crmUser.role);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    setIsOpen(false);
    setActiveNotification(notif);
    setViewingQuotationOpen(true);
    setLoadingQuotation(true);

    try {
      // Mark as read
      if (!notif.read) {
        await markNotificationAsRead(notif.id);
      }

      // Fetch quotation
      const quotation = await fetchQuotationById(notif.quotationId);
      if (quotation) {
        setSelectedQuotation(quotation);
      } else {
        toast.error("Quotation not found or has been deleted");
        setViewingQuotationOpen(false);
      }
    } catch (error) {
      console.error("Error loading quotation:", error);
      toast.error("Failed to load quotation details");
      setViewingQuotationOpen(false);
    } finally {
      setLoadingQuotation(false);
    }
  };

  const handleApprove = async () => {
    if (!activeNotification || !selectedQuotation) return;
    setActionLoading(true);
    try {
      await approveQuotationDoc(activeNotification.id, selectedQuotation.id);
      toast.success("Quotation approved successfully!");
      
      // Update local state to reflect approved status immediately
      setSelectedQuotation({
        ...selectedQuotation,
        status: "Sent",
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to approve quotation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeNotification || !selectedQuotation) return;
    setActionLoading(true);
    try {
      await rejectQuotationDoc(activeNotification.id, selectedQuotation.id);
      toast.success("Quotation rejected and marked as draft");
      
      // Update local state to reflect rejected status immediately
      setSelectedQuotation({
        ...selectedQuotation,
        status: "Draft",
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to reject quotation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedQuotation) return;
    setDownloadingPDF(true);
    try {
      await exportQuotationToPDF(selectedQuotation);
      toast.success("PDF downloaded successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const formatCurrency = (v: number) => `$${v.toLocaleString()}`;

  const isManager = crmUser.role === "sub_manager" || crmUser.role === "general_manager";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative hover:bg-accent/40 rounded-full transition-all duration-200"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground/80" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
            {unreadCount}
          </span>
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:text-primary-hover h-7 px-2"
              >
                Mark all as read
              </Button>
            )}
          </div>

          <div className="max-h-[350px] overflow-y-auto divide-y divide-border/40">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-colors duration-200 border-l-4 ${
                      isUnread
                        ? "bg-primary/5 hover:bg-primary/10 border-primary"
                        : "hover:bg-accent/40 border-transparent"
                    }`}
                  >
                    {/* Status Icon */}
                    <div className="mt-0.5 shrink-0">
                      {notif.status === "pending" && (
                        <div className="p-1 rounded-lg bg-warning/10 text-warning">
                          <Clock className="w-4 h-4" />
                        </div>
                      )}
                      {notif.status === "approved" && (
                        <div className="p-1 rounded-lg bg-success/10 text-success">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                      {notif.status === "rejected" && (
                        <div className="p-1 rounded-lg bg-destructive/10 text-destructive">
                          <XCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                          {notif.title}
                        </p>
                        {isUnread && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatRelativeTime(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Detailed Quotation Modal */}
      <Dialog open={viewingQuotationOpen} onOpenChange={setViewingQuotationOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl">
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="font-display flex items-center justify-between text-xl">
              <span>Quotation Details</span>
              {selectedQuotation && (
                <StageBadge stage={selectedQuotation.status} />
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingQuotation ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading quotation details...</p>
            </div>
          ) : selectedQuotation ? (
            <div className="space-y-6 pt-4">
              {/* Metadata Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-accent/30 p-4 rounded-xl">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Quotation Number:</span>
                  <span className="font-semibold text-sm text-foreground">{selectedQuotation.quotationNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Subject:</span>
                  <span className="font-semibold text-sm text-foreground">{selectedQuotation.subject}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Customer:</span>
                  <span className="font-medium text-foreground">{selectedQuotation.customerName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Company:</span>
                  <span className="font-medium text-foreground">{selectedQuotation.companyName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Email:</span>
                  <span className="text-foreground">{selectedQuotation.customerEmail || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Phone:</span>
                  <span className="text-foreground">{selectedQuotation.customerPhone || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Sales Person:</span>
                  <span className="font-medium text-foreground">{selectedQuotation.salesPersonName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Created Date:</span>
                  <span className="text-foreground">
                    {selectedQuotation.createdAt ? new Date(selectedQuotation.createdAt).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>

              {/* Products List */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Products</h4>
                <div className="border border-border/60 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-accent/40">
                      <TableRow>
                        <TableHead className="w-20">Image</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Part No</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuotation.products.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="w-12 h-12 rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground">
                                  <ImageOff className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-xs">{p.name}</p>
                            {p.description && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{p.description}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{p.modelNumber || "—"}</TableCell>
                          <TableCell className="text-xs">{p.partNumber || "—"}</TableCell>
                          <TableCell className="text-right font-medium text-xs">{formatCurrency(p.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between items-center mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <span className="text-xs font-medium text-muted-foreground">Total Quotation Value</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(selectedQuotation.totalValue)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border/40">
                {/* Manager Decision Actions */}
                {isManager && selectedQuotation.status === "Created" && (
                  <div className="flex flex-1 gap-2">
                    <Button
                      onClick={handleApprove}
                      className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold flex items-center gap-1.5 h-10"
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={handleReject}
                      variant="outline"
                      className="flex-1 border-destructive/30 hover:bg-destructive/5 text-destructive font-semibold flex items-center gap-1.5 h-10"
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}

                {/* PDF Actions */}
                <div className="flex flex-1 gap-2 justify-end w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={handleDownloadPDF}
                    className="flex-1 sm:flex-initial h-10"
                    disabled={downloadingPDF}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloadingPDF ? "Generating..." : "Download PDF"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setViewingQuotationOpen(false)}
                    className="flex-1 sm:flex-initial h-10 border border-border"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center py-6 text-sm text-muted-foreground">Error loading quotation.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
