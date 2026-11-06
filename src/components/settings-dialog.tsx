"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, BarChart3, Bot, Info, Languages, Loader2, MessageSquareText, Settings, Shield, User, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/admin/user-management";
import { AboutSettings } from "@/components/settings/about-settings";
import { AccountSettings } from "@/components/settings/account-settings";
import { AiProviderSettings } from "@/components/settings/ai-provider-settings";
import { CnmTagImportSettings } from "@/components/settings/cnm-tag-import-settings";
import { DangerZoneSettings } from "@/components/settings/danger-zone-settings";
import { DataBackupSettings } from "@/components/settings/data-backup-settings";
import { DebugLogSettings } from "@/components/settings/debug-log-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { PaperGroupSettings } from "@/components/settings/paper-group-settings";
import { PromptSettings } from "@/components/settings/prompt-settings";
import { TtsSettings } from "@/components/settings/tts-settings";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimeZone } from "@/contexts/TimeZoneContext";
import { apiClient } from "@/lib/api-client";
import { validateAiConfig } from "@/lib/ai-config-validation";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { toast } from "@/lib/feedback";
import { frontendLogger } from "@/lib/frontend-logger";
import type { AppConfig } from "@/types/api";

interface SettingsTabProps {
    value: string;
    icon: ReactNode;
    label: string;
}

function SettingsTab({ value, icon, label }: SettingsTabProps) {
    return (
        <TabsTrigger value={value} className="px-2 sm:px-3">
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </TabsTrigger>
    );
}

export function SettingsDialog() {
    const { setTimeZone } = useTimeZone();
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'admin';
    const { t } = useLanguage();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const dialogContentRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<AppConfig>({ aiProvider: 'minimax' });

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            setConfig(await apiClient.get<AppConfig>("/api/settings"));
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Failed to fetch settings', { error });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- 数据请求：进入页面或条件变化时加载，请求前后更新加载状态和结果
            fetchSettings();
        }
    }, [open, fetchSettings]);

    const handleSaveSettings = async () => {
        const validationError = validateAiConfig(config, t);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setSaving(true);
        try {
            const updated = await apiClient.post<AppConfig>("/api/settings", config);
            setConfig(updated);
            setTimeZone(updated.timeZone || DEFAULT_TIME_ZONE);
            toast.success(t.settings?.messages?.saved || "Settings saved");
            // 保存成功后滚动到顶部，方便关闭对话框
            dialogContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            frontendLogger.error('[SettingsDialog]', 'Failed to save settings', { error });
            toast.error(t.settings?.messages?.saveFailed || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    // 记住当前 tab，底部操作条按 tab 切换按钮文案
    const [activeTab, setActiveTab] = useState("general");
    const saveButton = (label: string) => (
        <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {label}
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">{t.settings?.title || "Settings"}</span>
                </Button>
            </DialogTrigger>
            <DialogContent ref={dialogContentRef} className="flex max-h-[85vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[900px]">
                <DialogHeader>
                    <DialogTitle>{t.settings?.title || "Settings"}</DialogTitle>
                    <DialogDescription>
                        {t.settings?.desc || 'Manage your preferences and data.'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" onValueChange={setActiveTab} className="flex min-h-0 w-full flex-1 flex-col">
                    <TabsList className={`grid w-full shrink-0 grid-cols-4 ${isAdmin ? 'sm:grid-cols-7' : 'sm:grid-cols-4'} gap-1 h-auto`}>
                        <SettingsTab value="general" icon={<Languages className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.general || "General"} />
                        <SettingsTab value="account" icon={<User className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.account || "Account"} />
                        {isAdmin && (
                            <>
                                <SettingsTab value="ai" icon={<Bot className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.ai || "AI Provider"} />
                                <SettingsTab value="prompts" icon={<MessageSquareText className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.prompts || "Prompts"} />
                                <SettingsTab value="admin" icon={<Shield className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.admin || "User Management"} />
                            </>
                        )}
                        <SettingsTab value="danger" icon={<AlertTriangle className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.danger || "Danger"} />
                        <SettingsTab value="about" icon={<Info className="h-4 w-4 sm:mr-2" />} label={t.settings?.tabs?.about || "About"} />
                    </TabsList>

                    <TabsContent value="general" className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
                        <GeneralSettings config={config} setConfig={setConfig} isAdmin={isAdmin} disabled={loading || saving} />
                        <PaperGroupSettings />
                    </TabsContent>

                    <TabsContent value="account" className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
                        <AccountSettings />
                    </TabsContent>

                    <TabsContent value="ai" className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
                        <AiProviderSettings config={config} setConfig={setConfig} loading={loading} saving={saving} onSave={handleSaveSettings} />
                        {!loading && <TtsSettings config={config} setConfig={setConfig} saving={saving} onSave={handleSaveSettings} />}
                    </TabsContent>

                    <TabsContent value="prompts" className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
                        <PromptSettings
                            config={config}
                            onUpdate={(type, value) => setConfig(prev => ({ ...prev, prompts: { ...prev.prompts, [type]: value } }))}
                        />
                    </TabsContent>

                    {isAdmin && (
                        <TabsContent value="admin" className="space-y-4 py-4">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    setOpen(false);
                                    router.push("/admin");
                                }}
                            >
                                <BarChart3 className="h-4 w-4" />
                                {t.admin?.dashboard?.title || "Admin Dashboard"}
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    setOpen(false);
                                    router.push("/setup");
                                }}
                            >
                                <Wand2 className="h-4 w-4" />
                                {t.setup.rerun}
                            </Button>
                            <DebugLogSettings />
                            <CnmTagImportSettings />
                            <div className="border-t pt-4">
                                <UserManagement />
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="danger" className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
                        <div className="space-y-3">
                            <DataBackupSettings isAdmin={isAdmin} />
                            <DangerZoneSettings isAdmin={isAdmin} />
                        </div>
                    </TabsContent>

                    <TabsContent value="about" className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
                        <AboutSettings />
                    </TabsContent>
                </Tabs>
                {/* 保存按钮常驻底部：内容再长也不用滚到底才能保存 */}
                {(activeTab === "prompts" || (activeTab === "general" && isAdmin)) && (
                    <div className="mt-2 shrink-0 border-t pt-3">
                        {saveButton(activeTab === "general"
                            ? (t.settings?.save || "Save Settings")
                            : (t.settings?.prompts?.save || "Save Prompt Settings"))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
