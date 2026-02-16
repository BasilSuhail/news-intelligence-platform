import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { secureFetch } from "@/lib/csrf";
import { RefreshCw, Eye, EyeOff } from "lucide-react";

export function NewsManager() {
  const [newsVisible, setNewsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/news/settings");
      const data = await response.json();
      setNewsVisible(data.visible !== false);
    } catch (error) {
      console.error("Failed to fetch news settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await secureFetch("/api/admin/news/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: newsVisible }),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      toast({
        title: "Success",
        description: "News section visibility updated successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update news settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>News Section Settings</CardTitle>
        <CardDescription>
          Control the visibility of the news section on your homepage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5 flex-1">
            <Label className="text-base flex items-center gap-2">
              {newsVisible ? (
                <Eye className="w-4 h-4 text-green-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              Show News Section
            </Label>
            <p className="text-sm text-muted-foreground">
              Display tech news briefings on your homepage
            </p>
          </div>
          <Switch
            checked={newsVisible}
            onCheckedChange={setNewsVisible}
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold mb-3">News Feed Information</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              • News data is loaded from <code className="px-1.5 py-0.5 bg-muted rounded text-xs">news_feed.json</code>
            </p>
            <p>
              • Users can refresh news using the Sync button on the homepage
            </p>
            <p>
              • Latest 6 briefings are displayed in the news section
            </p>
            <p>
              • Each briefing shows the date and AI-generated summary
            </p>
          </div>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSaving ? "animate-spin" : ""}`} />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
