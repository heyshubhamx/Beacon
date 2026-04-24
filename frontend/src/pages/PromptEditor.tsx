import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, Bell, AlertTriangle, Palette, Type, Layout, Eye, Monitor, Smartphone, Clock, ChevronDown, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../contexts/ApiContext';

// Import shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PromptConfig {
  type: 'slide' | 'modal' | 'native' | 'gate';
  text: string;
  title: string;
  acceptButtonText: string;
  rejectButtonText: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'top-middle' | 'bottom-middle';
  delay: number;
  colors: {
    background: string;
    text: string;
    acceptButton: string;
    acceptButtonText: string;
    rejectButton: string;
    rejectButtonText: string;
  };
}

interface Website {
  id: string;
  domain: string;
}

const DEFAULT_CONFIG: PromptConfig = {
  type: 'slide',
  text: 'Subscribe to our notifications for the latest updates.',
  title: 'Subscribe to Notifications',
  acceptButtonText: 'Subscribe',
  rejectButtonText: 'Later',
  position: 'bottom-right',
  delay: 2000,
  colors: {
    background: '#ffffff',
    text: '#333333',
    acceptButton: '#4f46e5',
    acceptButtonText: '#ffffff',
    rejectButton: '#f3f4f6',
    rejectButtonText: '#6b7280',
  },
};

// Color presets for quick theming
const COLOR_PRESETS = [
  { name: 'Indigo', acceptButton: '#4f46e5', background: '#ffffff', text: '#1f2937' },
  { name: 'Blue', acceptButton: '#2563eb', background: '#ffffff', text: '#1f2937' },
  { name: 'Emerald', acceptButton: '#059669', background: '#ffffff', text: '#1f2937' },
  { name: 'Rose', acceptButton: '#e11d48', background: '#ffffff', text: '#1f2937' },
  { name: 'Amber', acceptButton: '#d97706', background: '#ffffff', text: '#1f2937' },
  { name: 'Dark', acceptButton: '#6366f1', background: '#1f2937', text: '#f9fafb' },
];

const POSITION_GRID: { value: PromptConfig['position']; label: string; gridArea: string }[] = [
  { value: 'top-left', label: 'Top Left', gridArea: '1 / 1' },
  { value: 'top-middle', label: 'Top Center', gridArea: '1 / 2' },
  { value: 'top-right', label: 'Top Right', gridArea: '1 / 3' },
  { value: 'bottom-left', label: 'Bottom Left', gridArea: '3 / 1' },
  { value: 'bottom-middle', label: 'Bottom Center', gridArea: '3 / 2' },
  { value: 'bottom-right', label: 'Bottom Right', gridArea: '3 / 3' },
];

const PromptEditor = () => {
  const { id } = useParams<{ id: string }>();
  const { apiUrl, apiKey } = useApi();
  const navigate = useNavigate();

  const [website, setWebsite] = useState<Website | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedConfig, setSavedConfig] = useState<PromptConfig>(DEFAULT_CONFIG);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [justCopied, setJustCopied] = useState(false);

  const [config, setConfig] = useState<PromptConfig>(DEFAULT_CONFIG);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(savedConfig));
  }, [config, savedConfig]);

  // RGB to hex converter
  const rgbToHex = (rgb: string): string => {
    if (rgb === 'transparent' || !rgb || rgb === 'inherit' || rgb === 'initial') return rgb;
    if (rgb.startsWith('#')) return rgb;
    const matches = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!matches) return rgb;
    const r = parseInt(matches[1]);
    const g = parseInt(matches[2]);
    const b = parseInt(matches[3]);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchPromptConfig = async () => {
      setIsLoading(true);
      try {
        const websiteResponse = await fetch(`${apiUrl}/website/${id}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!websiteResponse.ok) throw new Error('Failed to fetch website details');
        const websiteData = await websiteResponse.json();
        setWebsite(websiteData);

        const configResponse = await fetch(`${apiUrl}/website/${id}/config`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (configResponse.ok) {
          const configData = await configResponse.json();
          const mergedConfig: PromptConfig = {
            ...DEFAULT_CONFIG,
            ...configData,
            colors: { ...DEFAULT_CONFIG.colors, ...(configData.colors || {}) }
          };
          if (mergedConfig.colors) {
            Object.keys(mergedConfig.colors).forEach(key => {
              const k = key as keyof typeof mergedConfig.colors;
              mergedConfig.colors[k] = rgbToHex(mergedConfig.colors[k]);
            });
          }
          setConfig(mergedConfig);
          setSavedConfig(mergedConfig);
        }
      } catch (error) {
        console.error('Error fetching prompt configuration:', error);
        toast.error('Failed to load prompt configuration.');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchPromptConfig();
  }, [id, apiUrl, apiKey]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${apiUrl}/website/${id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ promptConfig: config })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }
      setSavedConfig({ ...config });
      toast.success('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetConfig = () => {
    setConfig({ ...DEFAULT_CONFIG });
    toast('Reset to defaults', { icon: '🔄' });
  };

  const updateConfig = (updates: Partial<PromptConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateColor = (key: keyof PromptConfig['colors'], value: string) => {
    setConfig(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: rgbToHex(value) }
    }));
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setConfig(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        acceptButton: preset.acceptButton,
        acceptButtonText: '#ffffff',
        background: preset.background,
        text: preset.text,
        rejectButton: preset.background === '#1f2937' ? '#374151' : '#f3f4f6',
        rejectButtonText: preset.background === '#1f2937' ? '#9ca3af' : '#6b7280',
      }
    }));
  };

  const copyEmbedCode = () => {
    const code = `<script src="${apiUrl}/cdn-sdk/push-sdk.js"></script>
<script>
  Beacon.init({
    websiteId: '${id}',
    apiUrl: '${apiUrl}',
    registrationMode: 'auto'
  });
</script>`;
    navigator.clipboard.writeText(code);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
    toast.success('Embed code copied!');
  };

  // ─── Color Picker Field ───
  const ColorField = ({ label, colorKey }: { label: string; colorKey: keyof PromptConfig['colors'] }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={config.colors[colorKey] === 'transparent' ? '#f3f4f6' : config.colors[colorKey]}
            onChange={(e) => updateColor(colorKey, e.target.value)}
            className="h-9 w-9 rounded-lg cursor-pointer border border-input shadow-sm appearance-none bg-transparent"
            style={{ padding: 2 }}
          />
        </div>
        <Input
          type="text"
          value={config.colors[colorKey]}
          onChange={(e) => updateColor(colorKey, e.target.value)}
          className="h-9 font-mono text-xs"
        />
      </div>
    </div>
  );

  // ─── Live Preview Component ───
  const LivePreview = () => {
    const isMobile = previewDevice === 'mobile';

    // Build the position styles for the prompt inside the browser mockup
    const getPromptPositionStyles = (): React.CSSProperties => {
      const base: React.CSSProperties = { position: 'absolute', maxWidth: isMobile ? '90%' : '55%', width: isMobile ? '90%' : 'auto', minWidth: isMobile ? 'auto' : '220px' };
      if (config.type === 'modal') {
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: isMobile ? '85%' : '60%', width: isMobile ? '85%' : 'auto', minWidth: isMobile ? 'auto' : '240px' };
      }
      switch (config.position) {
        case 'top-left': return { ...base, top: 8, left: 8 };
        case 'top-middle': return { ...base, top: 8, left: '50%', transform: 'translateX(-50%)' };
        case 'top-right': return { ...base, top: 8, right: 8 };
        case 'bottom-left': return { ...base, bottom: 8, left: 8 };
        case 'bottom-middle': return { ...base, bottom: 8, left: '50%', transform: 'translateX(-50%)' };
        case 'bottom-right': default: return { ...base, bottom: 8, right: 8 };
      }
    };

    return (
      <div className="space-y-3">
        {/* Device switcher */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Preview</span>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`p-1.5 rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-1.5 rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Browser mockup */}
        <div className={`mx-auto transition-all duration-300 ${isMobile ? 'max-w-[240px]' : 'w-full'}`}>
          {/* Browser chrome */}
          <div className="bg-[#e8eaed] rounded-t-xl px-3 py-2 flex items-center gap-2 border border-b-0 border-[#dadce0]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></div>
            </div>
            <div className="flex-1 ml-2">
              <div className="bg-white rounded-md px-3 py-1 text-[10px] text-gray-500 font-mono truncate border border-gray-200">
                {website?.domain || 'example.com'}
              </div>
            </div>
          </div>

          {/* Browser viewport */}
          <div 
            className="bg-gradient-to-br from-slate-50 to-slate-100 border border-[#dadce0] rounded-b-xl relative overflow-hidden"
            style={{ height: isMobile ? 400 : 280 }}
          >
            {/* Fake page content */}
            <div className="p-4 space-y-3 opacity-30">
              <div className="h-4 bg-slate-300 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 rounded w-full"></div>
              <div className="h-3 bg-slate-200 rounded w-5/6"></div>
              <div className="h-20 bg-slate-200 rounded w-full mt-3"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              <div className="h-3 bg-slate-200 rounded w-4/5"></div>
            </div>

            {/* Modal / Gate overlay */}
            {(config.type === 'modal' || config.type === 'gate') && (
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
            )}

            {/* The actual prompt preview */}
            {(config.type === 'slide' || config.type === 'modal') && (
              <div style={getPromptPositionStyles()}>
                <div
                  className="rounded-xl shadow-xl overflow-hidden border border-black/5"
                  style={{ backgroundColor: config.colors.background, color: config.colors.text }}
                >
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Bell className="h-3 w-3 text-indigo-600" />
                      </div>
                      <span className="font-semibold text-xs leading-tight truncate" style={{ color: config.colors.text }}>
                        {config.title || 'Notification'}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed mb-3 opacity-80" style={{ color: config.colors.text }}>
                      {config.text || 'Subscribe to our notifications…'}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors"
                        style={{ backgroundColor: config.colors.rejectButton, color: config.colors.rejectButtonText }}
                      >
                        {config.rejectButtonText || 'Later'}
                      </button>
                      <button
                        className="px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors shadow-sm"
                        style={{ backgroundColor: config.colors.acceptButton, color: config.colors.acceptButtonText }}
                      >
                        {config.acceptButtonText || 'Subscribe'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gate full-screen lock preview */}
            {config.type === 'gate' && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div
                  className="rounded-xl shadow-2xl p-4 text-center w-[70%] max-w-[200px]"
                  style={{ backgroundColor: config.colors.background, color: config.colors.text }}
                >
                  <div
                    className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: config.colors.acceptButton + '1a' }}
                  >
                    <Bell className="h-5 w-5" style={{ color: config.colors.acceptButton }} />
                  </div>
                  <div className="text-[10px] font-bold mb-1" style={{ color: config.colors.text }}>
                    {config.title || 'Enable Notifications'}
                  </div>
                  <div className="text-[8px] opacity-60 mb-3" style={{ color: config.colors.text }}>
                    {config.text || 'Allow notifications to unlock content'}
                  </div>
                  <div
                    className="w-full py-1.5 text-[9px] font-semibold rounded-md"
                    style={{ backgroundColor: config.colors.acceptButton, color: config.colors.acceptButtonText }}
                  >
                    {config.acceptButtonText || 'Continue'}
                  </div>
                </div>
              </div>
            )}

            {/* Native browser prompt mockup */}
            {config.type === 'native' && (
              <div className="absolute top-0 left-0 right-0">
                <div className="bg-[#f0f0f0] border-b border-gray-300 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-400 rounded-sm flex items-center justify-center">
                      <Bell className="h-2.5 w-2.5 text-white" />
                    </div>
                    <span className="text-[10px] text-gray-700">
                      <strong>{website?.domain}</strong> wants to send you notifications
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="px-2 py-0.5 text-[9px] bg-white border border-gray-300 rounded text-gray-600">Block</button>
                    <button className="px-2 py-0.5 text-[9px] bg-blue-500 text-white rounded">Allow</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading State ───
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3"><Skeleton className="h-[500px] w-full rounded-xl" /></div>
          <div className="lg:col-span-2"><Skeleton className="h-[500px] w-full rounded-xl" /></div>
        </div>
      </div>
    );
  }

  if (!website) {
    return (
      <Card className="border-destructive max-w-lg mx-auto mt-12">
        <CardHeader>
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
            <CardTitle className="text-destructive">Website not found</CardTitle>
          </div>
          <CardDescription>
            The website you're trying to edit doesn't exist or you don't have access to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/domains">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to websites</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/domains/${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prompt Editor</h1>
            <p className="text-sm text-muted-foreground">
              Customize the opt-in prompt for <span className="font-medium text-foreground">{website.domain}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetConfig}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset
          </Button>
          <Button onClick={handleSaveConfig} disabled={isSaving || !hasUnsavedChanges} size="sm">
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                Saving…
              </span>
            ) : (
              <><Save className="h-3.5 w-3.5 mr-1.5" />{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</>
            )}
          </Button>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></div>
          You have unsaved changes
        </div>
      )}

      {/* ─── Main Layout: Editor + Preview ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Left: Settings ─── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Section 1: Prompt Type */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-100 rounded-lg"><Layout className="h-4 w-4 text-violet-600" /></div>
                <div>
                  <CardTitle className="text-base">Type & Position</CardTitle>
                  <CardDescription className="text-xs">Choose how and where the prompt appears</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Prompt Type Cards */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Prompt Style</Label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'slide' as const, label: 'Slide-in', desc: 'Corner popup', icon: '💬' },
                    { value: 'modal' as const, label: 'Modal', desc: 'Center overlay', icon: '🪟' },
                    { value: 'native' as const, label: 'Native', desc: 'Browser UI', icon: '🌐' },
                    { value: 'gate' as const, label: 'Content Gate', desc: 'Full-screen lock ⚡', icon: '🔒' },
                  ]).map((type) => (
                    <button
                      key={type.value}
                      onClick={() => updateConfig({ type: type.value })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        config.type === type.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-sm font-medium">{type.icon} {type.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{type.desc}</div>
                    </button>
                  ))}
                </div>
                {config.type === 'gate' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mt-3">
                    <strong>Content Gate</strong> locks the page until the user allows notifications. Includes fake verification step, denied-user instructions, and self-healing system. Best conversion rate.
                  </div>
                )}
              </div>

              {/* Position Grid */}
              {config.type === 'slide' && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Position</Label>
                  <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-xl p-3 border">
                    {POSITION_GRID.map((pos) => (
                      <button
                        key={pos.value}
                        onClick={() => updateConfig({ position: pos.value })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          config.position === pos.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-background hover:bg-primary/10 text-muted-foreground hover:text-foreground border border-transparent hover:border-primary/20'
                        }`}
                        style={{ gridArea: pos.gridArea }}
                      >
                        {pos.label}
                      </button>
                    ))}
                    {/* Center spacer representing the website */}
                    <div 
                      className="flex items-center justify-center text-[10px] text-muted-foreground border border-dashed border-muted-foreground/20 rounded-lg"
                      style={{ gridArea: '2 / 1 / 3 / 4' }}
                    >
                      <Eye className="h-3 w-3 mr-1 opacity-40" /> Website Content Area
                    </div>
                  </div>
                </div>
              )}

              {/* Delay */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display Delay</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={config.delay / 1000}
                      onChange={(e) => updateConfig({ delay: Math.max(0, parseFloat(e.target.value) || 0) * 1000 })}
                      className="pl-9 h-9"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">seconds</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Wait before showing the prompt. Recommended: 3–5 seconds.</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Content */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Type className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <CardTitle className="text-base">Content</CardTitle>
                  <CardDescription className="text-xs">Set the text users will see</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Title</Label>
                <Input
                  value={config.title}
                  onChange={(e) => updateConfig({ title: e.target.value })}
                  placeholder="Subscribe to Notifications"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Message</Label>
                <Textarea
                  value={config.text}
                  onChange={(e) => updateConfig({ text: e.target.value })}
                  placeholder="Subscribe to our notifications for the latest updates."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Accept Button</Label>
                  <Input
                    value={config.acceptButtonText}
                    onChange={(e) => updateConfig({ acceptButtonText: e.target.value })}
                    placeholder="Subscribe"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Reject Button</Label>
                  <Input
                    value={config.rejectButtonText}
                    onChange={(e) => updateConfig({ rejectButtonText: e.target.value })}
                    placeholder="Later"
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Appearance */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-100 rounded-lg"><Palette className="h-4 w-4 text-rose-600" /></div>
                <div>
                  <CardTitle className="text-base">Appearance</CardTitle>
                  <CardDescription className="text-xs">Colors and visual styling</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Quick presets */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:border-primary/30 hover:bg-muted/50 transition-all text-xs"
                    >
                      <div className="w-3 h-3 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: preset.acceptButton }}></div>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color grid */}
              <div className="grid grid-cols-2 gap-4">
                <ColorField label="Background" colorKey="background" />
                <ColorField label="Text" colorKey="text" />
                <ColorField label="Accept Button" colorKey="acceptButton" />
                <ColorField label="Accept Text" colorKey="acceptButtonText" />
                <ColorField label="Reject Button" colorKey="rejectButton" />
                <ColorField label="Reject Text" colorKey="rejectButtonText" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Right: Sticky Preview ─── */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-5">
            <Card>
              <CardContent className="pt-5">
                <LivePreview />
              </CardContent>
            </Card>

            {/* Embed Code */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Embed Code</CardTitle>
                <CardDescription className="text-xs">Add this to your website's HTML</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-muted rounded-lg p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto leading-relaxed">
{`<script src="${apiUrl}/cdn-sdk/push-sdk.js"></script>
<script>
  Beacon.init({
    websiteId: '${id}'
  });
</script>`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyEmbedCode}
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                  >
                    {justCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="pt-5">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Tips</h4>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span><strong>Slide-in</strong> prompts are less intrusive and convert better on content sites.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Add a <strong>3-5 second delay</strong> so users read your content first.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>Use your <strong>brand colors</strong> for higher trust and conversions.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;