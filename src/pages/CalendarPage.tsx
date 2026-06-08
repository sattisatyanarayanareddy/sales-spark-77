import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToSalesFunnel,
  subscribeToAllUsers,
  updateSalesFunnelDoc,
  fetchQuotationById,
} from "@/lib/firestore-service";
import { SalesFunnel, SalesFunnelStatus, CRMUser, Quotation } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  FileText,
  ListTodo,
  TrendingUp,
  CalendarDays,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABELS: Record<SalesFunnelStatus, string> = {
  Hot: "Hot",
  Warm: "Warm",
  Cold: "Cold",
  Closed: "Closed",
  Cancelled: "Cancelled",
  Lost: "Lost",
  Won: "Won",
};

// Vibrant Google Calendar style solid gradient event pill classes
const EVENT_CLASSES: Record<SalesFunnelStatus, string> = {
  Hot: "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-sm border-none shadow-red-500/10",
  Warm: "bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-sm border-none shadow-amber-500/10",
  Cold: "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm border-none shadow-purple-500/10",
  Won: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm border-none shadow-emerald-500/10",
  Closed: "bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-sm border-none shadow-slate-500/10",
  Lost: "bg-gradient-to-r from-rose-800 to-red-950 text-rose-100 shadow-sm border-none shadow-rose-950/10",
  Cancelled: "bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-sm border-none shadow-amber-600/10",
};

// Sidebar static status badge styles
const SIDEBAR_BADGE_CLASSES: Record<SalesFunnelStatus, string> = {
  Hot: "bg-red-500/10 text-red-600 border-red-500/20",
  Warm: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Cold: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Won: "bg-green-500/10 text-green-600 border-green-500/20",
  Closed: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  Lost: "bg-rose-950/10 text-rose-600 border-rose-950/20",
  Cancelled: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

interface CalendarEvent {
  deal: SalesFunnel;
  type: "followUp" | "closing";
}

const CalendarPage: React.FC = () => {
  const { crmUser } = useAuth();
  
  // Data States
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Date State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSalespersonId, setSelectedSalespersonId] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<SalesFunnelStatus[]>(["Hot", "Warm", "Cold", "Won", "Closed"]);

  // Detail & Action Modal States
  const [selectedDeal, setSelectedDeal] = useState<SalesFunnel | null>(null);
  const [selectedDayDeals, setSelectedDayDeals] = useState<{ date: Date; events: CalendarEvent[] } | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  
  // Reschedule Form States
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStatus, setRescheduleStatus] = useState<SalesFunnelStatus>("Cold");
  const [rescheduleClosingDate, setRescheduleClosingDate] = useState("");
  const [rescheduleRemarks, setRescheduleRemarks] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  // Subscribe to DB on Mount
  useEffect(() => {
    if (!crmUser) return;
    setLoadingData(true);

    const unsubFunnels = subscribeToSalesFunnel(crmUser.id, crmUser.role, (data) => {
      setFunnels(data);
      setLoadingData(false);
    });

    const unsubUsers = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
    });

    return () => {
      unsubFunnels();
      unsubUsers();
    };
  }, [crmUser]);

  // Load quotation details when selectedDeal changes
  useEffect(() => {
    if (!selectedDeal) {
      setQuotationDetail(null);
      return;
    }

    const loadQuotation = async () => {
      setLoadingQuotation(true);
      try {
        const quot = await fetchQuotationById(selectedDeal.quotationId);
        setQuotationDetail(quot);
      } catch (err) {
        console.error("Failed to load quotation", err);
        toast.error("Could not load quotation details");
      } finally {
        setLoadingQuotation(false);
      }
    };

    loadQuotation();

    // Populate reschedule form
    setRescheduleDate(selectedDeal.followUpDate || "");
    setRescheduleStatus(selectedDeal.status);
    setRescheduleClosingDate(selectedDeal.closingDate || "");
    setRescheduleRemarks(selectedDeal.remarks || "");
  }, [selectedDeal]);

  // Auth checking
  if (!crmUser) return null;

  const isGMOrAdmin = crmUser.role === "general_manager" || crmUser.role === "administrator";
  const isSubManager = crmUser.role === "sub_manager";

  // Filter salesperson list based on role permissions
  const visibleSalespeople = useMemo(() => {
    if (isGMOrAdmin) {
      return users.filter(u => !u.disabled && (u.role === "sales" || u.role === "sub_manager" || u.id === crmUser.id));
    }
    if (isSubManager) {
      return users.filter(u => !u.disabled && (u.id === crmUser.id || (u.managerId === crmUser.id && u.role === "sales")));
    }
    return users.filter(u => u.id === crmUser.id);
  }, [users, crmUser, isGMOrAdmin, isSubManager]);

  // Set default salesperson filter based on role
  useEffect(() => {
    if (visibleSalespeople.length > 0 && selectedSalespersonId === "all" && !isGMOrAdmin && !isSubManager) {
      setSelectedSalespersonId(crmUser.id);
    }
  }, [visibleSalespeople, selectedSalespersonId, isGMOrAdmin, isSubManager, crmUser]);

  // Filter funnels visible to the current role
  const roleFilteredFunnels = useMemo(() => {
    if (isGMOrAdmin) {
      return funnels.filter(f => !f.disabled);
    }
    if (isSubManager) {
      const allowedIds = visibleSalespeople.map(u => u.id);
      return funnels.filter(f => !f.disabled && allowedIds.includes(f.salesPersonId));
    }
    return funnels.filter(f => !f.disabled && f.salesPersonId === crmUser.id);
  }, [funnels, crmUser, isGMOrAdmin, isSubManager, visibleSalespeople]);

  // Apply search/salesperson/status filters
  const filteredFunnels = useMemo(() => {
    return roleFilteredFunnels.filter((f) => {
      // Salesperson filter
      if (selectedSalespersonId !== "all" && f.salesPersonId !== selectedSalespersonId) {
        return false;
      }
      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(f.status)) {
        return false;
      }
      // Search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const salesPersonName = users.find(u => u.id === f.salesPersonId)?.name?.toLowerCase() || "";
        return (
          f.companyName.toLowerCase().includes(query) ||
          f.subject.toLowerCase().includes(query) ||
          f.quotationNumber.toLowerCase().includes(query) ||
          salesPersonName.includes(query)
        );
      }
      return true;
    });
  }, [roleFilteredFunnels, selectedSalespersonId, selectedStatuses, searchQuery, users]);

  // Calculate Calendar Days for Month View
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed
    
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    
    const days = [];
    
    // Padding days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }
    
    // Days of current month
    const currentMonthLastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= currentMonthLastDay; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Padding days from next month to fill grid (multiples of 7, up to 42 cells)
    const totalCells = days.length > 35 ? 42 : 35;
    const nextMonthPadding = totalCells - days.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  }, [currentDate]);

  // Format Helper for Matching YYYY-MM-DD
  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Group deals by both followUpDate and closingDate
  const dealsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredFunnels.forEach((deal) => {
      if (deal.followUpDate) {
        if (!map[deal.followUpDate]) {
          map[deal.followUpDate] = [];
        }
        map[deal.followUpDate].push({ deal, type: "followUp" });
      }
      if (deal.closingDate) {
        if (!map[deal.closingDate]) {
          map[deal.closingDate] = [];
        }
        map[deal.closingDate].push({ deal, type: "closing" });
      }
    });
    return map;
  }, [filteredFunnels]);

  // Navigation handlers
  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleMonthChange = (monthName: string) => {
    const monthIndex = MONTHS.indexOf(monthName);
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);
  };

  const handleYearChange = (yearStr: string) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(parseInt(yearStr, 10));
    setCurrentDate(newDate);
  };

  // Target Closing Deals for currently viewed Month/Year
  const targetClosingDeals = useMemo(() => {
    const monthIndex = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const prefix = `${year}-${String(monthIndex).padStart(2, "0")}`;
    return roleFilteredFunnels.filter(f => f.closingDate && f.closingDate.startsWith(prefix));
  }, [roleFilteredFunnels, currentDate]);

  // Save deal updates
  const handleSaveUpdate = async () => {
    if (!selectedDeal) return;

    if (!rescheduleRemarks || !rescheduleRemarks.trim()) {
      toast.error("Remarks are required to update a deal");
      return;
    }

    if (!rescheduleClosingDate) {
      toast.error("Closing Date is required");
      return;
    }

    setSavingAction(true);
    try {
      const isWon = rescheduleStatus === "Won";
      const now = new Date();
      const defaultMonth = now.toLocaleString(undefined, { month: "long" });

      await updateSalesFunnelDoc(selectedDeal.id, {
        status: rescheduleStatus,
        followUpDate: rescheduleDate || null,
        closingDate: rescheduleClosingDate,
        wonMonth: isWon ? (selectedDeal.wonMonth || defaultMonth) : null,
        remarks: rescheduleRemarks.trim(),
      });
      toast.success("Deal details updated successfully!");
      setSelectedDeal(null);
      setSelectedDayDeals(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update deal");
    } finally {
      setSavingAction(false);
    }
  };

  // Toggle selected statuses
  const toggleStatusFilter = (status: SalesFunnelStatus) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
  };

  return (
    <TooltipProvider>
      <div className="page-container space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Schedule Calendar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Google Calendar-style view of upcoming follow-ups and deals.
            </p>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-2">

            {/* Month Dropdown Selector */}
            <Select value={MONTHS[currentDate.getMonth()]} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-32 text-xs h-9 rounded-xl font-bold bg-card border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Dropdown Selector */}
            <Select value={String(currentDate.getFullYear())} onValueChange={handleYearChange}>
              <SelectTrigger className="w-24 text-xs h-9 rounded-xl font-bold bg-card border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {Array.from({ length: 15 }, (_, i) => String(2020 + i)).map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Calendar Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 p-4 bg-card border border-border/80 rounded-2xl text-xs">
          <span className="font-semibold text-muted-foreground mr-1">Legend:</span>
          
          {/* Follow-up */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-blue-700 shadow shadow-blue-500/10" />
            <span className="font-medium text-foreground">Follow-up Date (📞)</span>
          </div>

          <div className="h-4 w-px bg-border/60 hidden sm:block" />

          {/* Target Closings / Stages */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider">Target Closing Stage (🎯):</span>
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-rose-500 to-red-600 shadow shadow-red-500/10" />
              <span className="font-medium text-foreground">Hot</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-orange-400 to-amber-500 shadow shadow-amber-500/10" />
              <span className="font-medium text-foreground">Warm</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-violet-500 to-purple-600 shadow shadow-purple-500/10" />
              <span className="font-medium text-foreground">Cold</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-emerald-500 to-green-600 shadow shadow-emerald-500/10" />
              <span className="font-medium text-foreground">Won</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-slate-500 to-slate-600 shadow shadow-slate-500/10" />
              <span className="font-medium text-foreground">Closed</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-rose-800 to-red-950 shadow shadow-rose-950/10" />
              <span className="font-medium text-foreground">Lost</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-yellow-500 to-amber-600 shadow shadow-amber-600/10" />
              <span className="font-medium text-foreground">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Workspace Layout */}
        {loadingData ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="w-full">
            <div className="bg-card border border-border shadow-sm rounded-3xl overflow-hidden">
                
                {/* Sun - Sat headers */}
                <div className="grid grid-cols-7 border-b border-border/50 bg-muted/40 py-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="text-center font-display font-semibold text-xs text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 grid-rows-5 bg-border/20 gap-[1px]">
                  {calendarGrid.map((day, idx) => {
                    const dateKey = formatDateKey(day.date);
                    const dayDeals = dealsByDate[dateKey] || [];
                    const isToday = formatDateKey(new Date()) === dateKey;
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (dayDeals.length > 0) {
                            setSelectedDayDeals({ date: day.date, events: dayDeals });
                          }
                        }}
                        className={`min-h-[145px] xl:min-h-[165px] bg-card p-3 flex flex-col justify-between transition-all duration-150 ${
                          day.isCurrentMonth ? "text-foreground" : "text-muted-foreground/40 bg-muted/5"
                        } ${dayDeals.length > 0 ? "cursor-pointer hover:bg-muted/5" : ""}`}
                      >
                        {/* Cell Date Header */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                              isToday
                                ? "bg-primary text-white font-bold shadow-md shadow-primary/20 scale-105"
                                : ""
                            }`}
                          >
                            {day.date.getDate()}
                          </span>
                        </div>

                        {/* Stacking Events/Deals as Google Calendar Event Strips */}
                        <div className="flex-1 space-y-1.5 mt-1.5 overflow-y-auto max-h-[95px] xl:max-h-[115px] scrollbar-thin">
                          {dayDeals.slice(0, 2).map((event, eventIdx) => {
                            const deal = event.deal;
                            const isFollowUp = event.type === "followUp";
                            return (
                              <Tooltip key={`${deal.id}-${event.type}-${eventIdx}`}>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation(); // Stop opening the day deals list dialog
                                      setSelectedDeal(deal);
                                    }}
                                    className={`px-3 py-2 rounded-xl shadow-md transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] flex flex-col justify-center gap-1 cursor-pointer border border-white/10 select-none min-h-[48px] ${
                                      isFollowUp
                                        ? "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm border-none shadow-blue-500/10"
                                        : EVENT_CLASSES[deal.status]
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 w-full">
                                      <span className="font-bold text-[11px] xl:text-xs truncate leading-snug">
                                        {isFollowUp ? "📞 " : "🎯 "}{deal.companyName}
                                      </span>
                                      <span className="font-extrabold text-[9px] xl:text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md shrink-0">
                                        ${Math.round(deal.quotationValue / 1000)}k
                                      </span>
                                    </div>
                                    <div className="text-[10px] xl:text-[11px] opacity-90 truncate leading-snug font-medium text-left">
                                      {deal.subject}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="p-3 max-w-xs rounded-xl bg-card border border-border/80 shadow-lg text-foreground">
                                  <p className="font-bold text-xs">{isFollowUp ? "Follow-up: " : "Target Close: "}{deal.companyName}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{deal.subject}</p>
                                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/40 text-[10px]">
                                    <span className="font-semibold text-primary">${deal.quotationValue.toLocaleString()}</span>
                                    <span className="font-medium text-muted-foreground">
                                      {isFollowUp ? `Follow-up: ${deal.followUpDate || "—"}` : `Closing: ${deal.closingDate || "—"}`}
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          
                          {/* Excess item indicator */}
                          {dayDeals.length > 2 && (
                            <div className="text-[9px] text-center font-bold text-muted-foreground/80 bg-muted/40 py-0.5 rounded-lg border border-border/10">
                              + {dayDeals.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
        )}

        {/* DAY DEALS SUMMARY DIALOG */}
        <Dialog open={!!selectedDayDeals} onOpenChange={() => setSelectedDayDeals(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">
                Follow-ups for {selectedDayDeals?.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </DialogTitle>
              <DialogDescription>
                Select a deal follow-up to view details or update targets.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-2 max-h-[350px] overflow-y-auto pr-1">
              {selectedDayDeals?.events.map((event, eventIdx) => {
                const deal = event.deal;
                const isFollowUp = event.type === "followUp";
                return (
                  <div
                    key={`${deal.id}-${event.type}-${eventIdx}`}
                    onClick={() => {
                      setSelectedDeal(deal);
                      setSelectedDayDeals(null);
                    }}
                    className={`p-3 rounded-xl border bg-card hover:bg-muted/40 cursor-pointer transition-all duration-150 flex justify-between items-center ${
                      isFollowUp ? "border-blue-500/20 hover:border-blue-500/40" :
                      deal.status === "Hot" ? "border-red-500/20 hover:border-red-500/40" :
                      deal.status === "Warm" ? "border-orange-500/20 hover:border-orange-500/40" :
                      deal.status === "Won" ? "border-green-500/20 hover:border-green-500/40" :
                      "border-border/60 hover:border-primary/20"
                    }`}
                  >
                    <div>
                      <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        {isFollowUp ? "📞 " : "🎯 "}{deal.companyName}
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-semibold border ${
                          isFollowUp ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : SIDEBAR_BADGE_CLASSES[deal.status]
                        }`}>
                          {isFollowUp ? "Follow-up" : deal.status}
                        </span>
                      </h5>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-[220px]">{deal.subject}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-xs text-primary">
                        ${deal.quotationValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* DETAIL & RESCHEDULE DIALOG */}
        <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Deal Details & Target Edit</span>
              </DialogTitle>
              <DialogDescription>
                Review details and reschedule follow-up dates or targets.
              </DialogDescription>
            </DialogHeader>

            {selectedDeal && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-4">
                
                {/* Deal Details Column */}
                <div className="md:col-span-3 space-y-4">
                  
                  {/* Deal Header Overview */}
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quotation No</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {selectedDeal.quotationNumber}
                      </Badge>
                    </div>
                    <h4 className="text-lg font-bold text-foreground mt-2">{selectedDeal.companyName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedDeal.subject}</p>
                    
                    <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Quotation Value</span>
                        <span className="text-base font-extrabold text-primary">
                          ${selectedDeal.quotationValue.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">PO Value</span>
                        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          {selectedDeal.poValue > 0 ? `$${selectedDeal.poValue.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment & Delivery Status */}
                  <div className="p-3 rounded-2xl border border-border/30 space-y-2">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Pipeline Status
                    </h5>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Delivery status:</span>
                        <span className="font-semibold block mt-0.5">{selectedDeal.deliveryStatus}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Payment pending:</span>
                        <span className="font-semibold block mt-0.5">
                          {selectedDeal.invoiceValue > 0 ? (
                            selectedDeal.paymentStatus === "Completed" ? (
                              <span className="text-emerald-600 font-bold">Paid</span>
                            ) : (
                              `$${selectedDeal.pendingPayment.toLocaleString()} due (${selectedDeal.paymentStatus})`
                            )
                          ) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quotation Itemized / Product Summary */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Products Info</h5>
                    
                    {loadingQuotation ? (
                      <div className="flex items-center justify-center p-6 bg-muted/20 border border-dashed rounded-2xl">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                        <span className="text-xs text-muted-foreground">Fetching items...</span>
                      </div>
                    ) : quotationDetail && quotationDetail.products?.length > 0 ? (
                      <div className="max-h-[160px] overflow-y-auto space-y-2 border border-border/30 rounded-2xl p-2 bg-muted/10">
                        {quotationDetail.products.map((p, pIdx) => (
                          <div key={pIdx} className="flex justify-between items-center bg-card p-2 rounded-xl border border-border/10 text-xs">
                            <div>
                              <p className="font-bold text-foreground">{p.name}</p>
                              {p.sku && <p className="text-[10px] text-muted-foreground">SKU: {p.sku}</p>}
                            </div>
                            <div className="text-right font-medium">
                              ${p.value.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/20 border border-dashed border-border/40 rounded-2xl text-center">
                        <p className="text-xs text-muted-foreground italic">No products listed.</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* Update targets and schedules form */}
                <div className="md:col-span-2 space-y-4 border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                    <ListTodo className="w-3.5 h-3.5 text-primary" /> Update Schedule
                  </h5>
                  
                  <div className="space-y-4">
                    
                    {/* Reschedule Date */}
                    <div className="space-y-2">
                      <Label htmlFor="reschedule-date" className="text-xs font-semibold">
                        Follow-up Date (Optional)
                      </Label>
                      <Input
                        id="reschedule-date"
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="rounded-xl text-xs h-9"
                      />
                    </div>

                    {/* Target Closing Date */}
                    <div className="space-y-2">
                      <Label htmlFor="target-closing-date" className="text-xs font-semibold">
                        Closing Date *
                      </Label>
                      <Input
                        id="target-closing-date"
                        type="date"
                        required
                        value={rescheduleClosingDate}
                        onChange={(e) => setRescheduleClosingDate(e.target.value)}
                        className="rounded-xl text-xs h-9"
                      />
                    </div>

                    {/* Reschedule Status */}
                    <div className="space-y-2">
                      <Label htmlFor="reschedule-status" className="text-xs font-semibold">
                        Deal Stage
                      </Label>
                      <Select
                        value={rescheduleStatus}
                        onValueChange={(val) => setRescheduleStatus(val as SalesFunnelStatus)}
                      >
                        <SelectTrigger id="reschedule-status" className="text-xs h-9 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {Object.entries(STATUS_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reschedule Remarks */}
                    <div className="space-y-2">
                      <Label htmlFor="reschedule-remarks" className="text-xs font-semibold">
                        Remarks / Comments *
                      </Label>
                      <Textarea
                        id="reschedule-remarks"
                        placeholder="Add scheduling comments..."
                        value={rescheduleRemarks}
                        onChange={(e) => setRescheduleRemarks(e.target.value)}
                        className="rounded-xl text-xs min-h-[80px]"
                      />
                    </div>

                    {/* Action button */}
                    <Button
                      onClick={handleSaveUpdate}
                      disabled={savingAction || !rescheduleRemarks.trim() || !rescheduleClosingDate}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-blue-700 hover:from-primary/95 hover:to-blue-700/95 text-white font-medium text-xs shadow"
                    >
                      {savingAction ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...
                        </>
                      ) : (
                        "Save Updates"
                      )}
                    </Button>
                  </div>
                </div>

              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
};

export default CalendarPage;
