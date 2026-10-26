import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    Camera,
    Cpu,
    Volume2,
    Bell,
    Server,
    Save,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    Wifi,
    Shield,
    Activity,
    Sliders,
    Play
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

interface SystemSettings {
    // Camera & Stream
    roadCameraUrl: string;
    scanIntervalMs: number;
    autoConnectPhoneCam: boolean;

    // AI & Detection Thresholds
    anprMinConfidence: number;
    faceThreshold: number;
    autoSaveDetections: boolean;
    penModeDefault: boolean;

    // Voice & TTS
    voiceAlertsEnabled: boolean;
    ttsRate: number;
    ttsPitch: number;

    // System & Alerts
    alertSoundEnabled: boolean;
    autoRefreshDashboard: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
    roadCameraUrl: 'http://10.53.145.34:8080/video',
    scanIntervalMs: 3000,
    autoConnectPhoneCam: false,
    anprMinConfidence: 0.25,
    faceThreshold: 0.55,
    autoSaveDetections: true,
    penModeDefault: true,
    voiceAlertsEnabled: true,
    ttsRate: 1.0,
    ttsPitch: 1.0,
    alertSoundEnabled: true,
    autoRefreshDashboard: true
};

export default function Settings() {
    const [activeTab, setActiveTab] = useState<'camera' | 'ai' | 'voice' | 'system'>('camera');
    const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [testCamStatus, setTestCamStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [apiHealth, setApiHealth] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');

    // Load saved settings from localStorage on initial render
    useEffect(() => {
        try {
            const saved = localStorage.getItem('surveillance_system_settings');
            if (saved) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            }
        } catch (e) {
            console.error('Failed to parse saved settings:', e);
        }

        // Check backend health
        checkApiHealth();
    }, []);

    const checkApiHealth = async () => {
        try {
            setApiHealth('checking');
            const res = await api.get('/health');
            if (res.data?.status === 'healthy') {
                setApiHealth('healthy');
            } else {
                setApiHealth('unhealthy');
            }
        } catch {
            setApiHealth('unhealthy');
        }
    };

    const handleSave = () => {
        localStorage.setItem('surveillance_system_settings', JSON.stringify(settings));
        // Also update individual shortcut keys used in other pages
        localStorage.setItem('road_camera_url', settings.roadCameraUrl);
        localStorage.setItem('anpr_interval', settings.scanIntervalMs.toString());
        localStorage.setItem('voice_alerts', settings.voiceAlertsEnabled ? '1' : '0');

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleReset = () => {
        if (window.confirm('Reset all surveillance system settings to factory defaults?')) {
            setSettings(DEFAULT_SETTINGS);
            localStorage.removeItem('surveillance_system_settings');
            localStorage.setItem('road_camera_url', DEFAULT_SETTINGS.roadCameraUrl);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }
    };

    // Test Phone Camera Connection
    const testPhoneCamera = async () => {
        setTestCamStatus('testing');
        try {
            const pingUrl = settings.roadCameraUrl.replace('/video', '/shot.jpg');
            const img = new Image();
            img.src = `${pingUrl}?t=${Date.now()}`;
            img.onload = () => setTestCamStatus('success');
            img.onerror = () => setTestCamStatus('failed');
            setTimeout(() => {
                if (testCamStatus === 'testing') setTestCamStatus('failed');
            }, 5000);
        } catch {
            setTestCamStatus('failed');
        }
    };

    // Test Speech Synthesis
    const testSpeech = () => {
        if (!('speechSynthesis' in window)) {
            alert('Speech Synthesis not supported by this browser.');
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('AI Surveillance alert test: Indian license plate detected and verified.');
        utterance.rate = settings.ttsRate;
        utterance.pitch = settings.ttsPitch;
        window.speechSynthesis.speak(utterance);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                            <SettingsIcon className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-text">System Configuration</h1>
                    </div>
                    <p className="text-sm text-text-muted">
                        Configure Phone IP camera streams, ANPR thresholds, AI detection engines & audio alerts
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-surface-hover text-text-muted hover:text-text text-sm font-medium border border-border rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg shadow-lg shadow-primary/20 transition-all"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Save Success Banner */}
            {saveSuccess && (
                <div className="p-3.5 bg-success/10 border border-success/30 rounded-xl flex items-center gap-3 text-success text-sm font-medium animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Settings saved successfully and persisted to browser storage!</span>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-border gap-2 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => setActiveTab('camera')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                        activeTab === 'camera'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-text'
                    )}
                >
                    <Camera className="w-4 h-4" />
                    Camera & Streams
                </button>

                <button
                    onClick={() => setActiveTab('ai')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                        activeTab === 'ai'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-text'
                    )}
                >
                    <Cpu className="w-4 h-4" />
                    AI & Detection
                </button>

                <button
                    onClick={() => setActiveTab('voice')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                        activeTab === 'voice'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-text'
                    )}
                >
                    <Volume2 className="w-4 h-4" />
                    Voice & Audio
                </button>

                <button
                    onClick={() => setActiveTab('system')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                        activeTab === 'system'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-muted hover:text-text'
                    )}
                >
                    <Server className="w-4 h-4" />
                    System & Telemetry
                </button>
            </div>

            {/* Tab 1: Camera & Streams */}
            {activeTab === 'camera' && (
                <div className="space-y-6">
                    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                <Wifi className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-text">Phone Camera Configuration</h3>
                                <p className="text-xs text-text-muted">Android "IP Webcam" application stream endpoint used for Road Cam</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Road Camera Stream URL
                                </label>
                                <input
                                    type="text"
                                    value={settings.roadCameraUrl}
                                    onChange={(e) => setSettings({ ...settings, roadCameraUrl: e.target.value })}
                                    placeholder="http://10.53.145.34:8080/video"
                                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-text text-sm font-mono focus:border-primary focus:outline-none"
                                />
                                <p className="text-xs text-text-muted">
                                    Default format: <span className="font-mono text-primary">http://&lt;phone-lan-ip&gt;:8080/video</span>
                                </p>
                            </div>

                            <div className="flex flex-col justify-end">
                                <button
                                    onClick={testPhoneCamera}
                                    disabled={testCamStatus === 'testing'}
                                    className="w-full py-2.5 px-4 bg-surface-hover hover:bg-border text-text text-sm font-medium border border-border rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Activity className={cn("w-4 h-4", testCamStatus === 'testing' && "animate-spin text-primary")} />
                                    {testCamStatus === 'testing' ? 'Pinging Camera...' : 'Test Connection'}
                                </button>
                            </div>
                        </div>

                        {testCamStatus === 'success' && (
                            <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2 text-success text-xs font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                Camera is reachable! Snapshot stream verified on {settings.roadCameraUrl}.
                            </div>
                        )}

                        {testCamStatus === 'failed' && (
                            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-xs font-medium">
                                <AlertCircle className="w-4 h-4" />
                                Connection failed. Please ensure phone screen is active and on the same Wi-Fi network.
                            </div>
                        )}
                    </div>

                    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                        <h3 className="text-base font-semibold text-text">Scanning Performance</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Vehicle Auto-Scan Interval ({settings.scanIntervalMs / 1000}s)
                                </label>
                                <input
                                    type="range"
                                    min="1000"
                                    max="10000"
                                    step="500"
                                    value={settings.scanIntervalMs}
                                    onChange={(e) => setSettings({ ...settings, scanIntervalMs: Number(e.target.value) })}
                                    className="w-full accent-primary cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-text-muted">
                                    <span>Fast (1s)</span>
                                    <span>Balanced (3s)</span>
                                    <span>Eco (10s)</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                                <div>
                                    <div className="text-sm font-medium text-text">Auto-Connect Road Cam</div>
                                    <div className="text-xs text-text-muted">Switch directly to phone cam on opening Vehicles page</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.autoConnectPhoneCam}
                                    onChange={(e) => setSettings({ ...settings, autoConnectPhoneCam: e.target.checked })}
                                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: AI & Detection */}
            {activeTab === 'ai' && (
                <div className="space-y-6">
                    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-text">ANPR License Plate & YOLO Parameters</h3>
                                <p className="text-xs text-text-muted">Adjust model confidence to tune out false positives</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-text-muted uppercase tracking-wider">ANPR Min Confidence</span>
                                    <span className="text-primary font-mono">{Math.round(settings.anprMinConfidence * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.10"
                                    max="0.80"
                                    step="0.05"
                                    value={settings.anprMinConfidence}
                                    onChange={(e) => setSettings({ ...settings, anprMinConfidence: Number(e.target.value) })}
                                    className="w-full accent-primary cursor-pointer"
                                />
                                <p className="text-xs text-text-muted">Higher values reject blurry number plates.</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-text-muted uppercase tracking-wider">Face Recognition Distance Threshold</span>
                                    <span className="text-emerald-400 font-mono">{settings.faceThreshold}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.30"
                                    max="0.80"
                                    step="0.05"
                                    value={settings.faceThreshold}
                                    onChange={(e) => setSettings({ ...settings, faceThreshold: Number(e.target.value) })}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                                <p className="text-xs text-text-muted">Maximum Euclidean distance for face matching (default 0.55).</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
                            <div className="flex items-center justify-between p-3.5 bg-background border border-border rounded-lg">
                                <div>
                                    <div className="text-sm font-medium text-text">Auto-Save Vehicle Records</div>
                                    <div className="text-xs text-text-muted">Automatically commit new plate reads to SQLite DB</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.autoSaveDetections}
                                    onChange={(e) => setSettings({ ...settings, autoSaveDetections: e.target.checked })}
                                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 bg-background border border-border rounded-lg">
                                <div>
                                    <div className="text-sm font-medium text-text">Object Pen/Stylus Detection Mode</div>
                                    <div className="text-xs text-text-muted">Enable stationery heuristic refinement in Objects page</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.penModeDefault}
                                    onChange={(e) => setSettings({ ...settings, penModeDefault: e.target.checked })}
                                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Voice & Audio */}
            {activeTab === 'voice' && (
                <div className="space-y-6">
                    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                                    <Volume2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-text">Text-to-Speech (TTS) Voice Announcements</h3>
                                    <p className="text-xs text-text-muted">Voice readouts for license plates & detected security objects</p>
                                </div>
                            </div>

                            <input
                                type="checkbox"
                                checked={settings.voiceAlertsEnabled}
                                onChange={(e) => setSettings({ ...settings, voiceAlertsEnabled: e.target.checked })}
                                className="w-5 h-5 accent-primary rounded cursor-pointer"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-text-muted uppercase tracking-wider">Speech Rate / Speed</span>
                                    <span className="text-amber-400 font-mono">{settings.ttsRate}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.7"
                                    max="1.5"
                                    step="0.1"
                                    value={settings.ttsRate}
                                    onChange={(e) => setSettings({ ...settings, ttsRate: Number(e.target.value) })}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-text-muted uppercase tracking-wider">Speech Pitch</span>
                                    <span className="text-amber-400 font-mono">{settings.ttsPitch}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.8"
                                    max="1.4"
                                    step="0.1"
                                    value={settings.ttsPitch}
                                    onChange={(e) => setSettings({ ...settings, ttsPitch: Number(e.target.value) })}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={testSpeech}
                                className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-border text-text text-sm font-medium border border-border rounded-lg transition-colors"
                            >
                                <Play className="w-4 h-4 text-amber-400" />
                                Test Voice Audio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 4: System & Telemetry */}
            {activeTab === 'system' && (
                <div className="space-y-6">
                    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                        <h3 className="text-base font-semibold text-text">Backend Service Status</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-background border border-border rounded-xl space-y-1">
                                <span className="text-xs text-text-muted">API Health</span>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "w-2.5 h-2.5 rounded-full",
                                        apiHealth === 'healthy' ? "bg-success" : apiHealth === 'unhealthy' ? "bg-danger" : "bg-warning animate-pulse"
                                    )}></span>
                                    <span className="font-semibold text-text capitalize">{apiHealth}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-background border border-border rounded-xl space-y-1">
                                <span className="text-xs text-text-muted">Database Engine</span>
                                <div className="font-semibold text-text">SQLite (Async SQLAlchemy)</div>
                            </div>

                            <div className="p-4 bg-background border border-border rounded-xl space-y-1">
                                <span className="text-xs text-text-muted">AI Detection Models</span>
                                <div className="font-semibold text-text">YOLOv8 + EasyOCR</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                        <h3 className="text-base font-semibold text-text">Browser Cache & Storage</h3>
                        <p className="text-xs text-text-muted">Clear stored camera IP settings and local state tokens.</p>

                        <button
                            onClick={() => {
                                localStorage.clear();
                                alert('Local cache and tokens cleared.');
                                window.location.reload();
                            }}
                            className="px-4 py-2 bg-danger/10 hover:bg-danger text-danger hover:text-white text-sm font-medium border border-danger/30 rounded-lg transition-colors"
                        >
                            Clear Storage & Cache
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
