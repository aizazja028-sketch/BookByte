import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Upload, Eye, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportUserId, importUserId, getUserId } from "@/lib/userIdentifier";

export const IdentifierManager = () => {
  const [importValue, setImportValue] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const handleExport = () => {
    const userId = exportUserId();
    navigator.clipboard.writeText(userId);
    toast.success("User ID copied to clipboard!");
  };

  const handleDownload = () => {
    const userId = exportUserId();
    const blob = new Blob([userId], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookbyte-user-id-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("User ID downloaded!");
  };

  const handleImport = () => {
    try {
      importUserId(importValue.trim());
      toast.success("User ID imported successfully! Reloading...");
      setImportValue("");
      setImportOpen(false);
      // Reload to apply the new user ID
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error("Invalid user ID format. Please enter a valid UUID.");
    }
  };

  return (
    <div className="flex gap-1 sm:gap-2">
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="gap-1.5 px-2.5 py-2 h-9 hover:bg-muted hover:text-foreground transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden md:inline text-xs">View ID</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your User ID</DialogTitle>
            <DialogDescription>
              This is your unique identifier. Save it to restore your reading history on another device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
              {getUserId()}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExport} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Copy
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
                <FileDown className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="gap-1.5 px-2.5 py-2 h-9 hover:bg-muted hover:text-foreground transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden md:inline text-xs">Import ID</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import User ID</DialogTitle>
            <DialogDescription>
              Paste your user ID to restore your reading history and preferences. This will replace your current ID.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Paste your UUID here (e.g., 123e4567-e89b-12d3-a456-426614174000)"
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              className="font-mono text-sm"
            />
            <Button onClick={handleImport} disabled={!importValue.trim()}>
              Import & Reload
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
