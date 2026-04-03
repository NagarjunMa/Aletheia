import dynamic from "next/dynamic";

const SettingsContent = dynamic(() => import("./_settings-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  ),
});

export default function SettingsPage() {
  return <SettingsContent />;
}
