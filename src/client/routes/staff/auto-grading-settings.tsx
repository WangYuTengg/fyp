import { createFileRoute } from '@tanstack/react-router';
import { SettingsTab } from '../../features/staff-grading/components/SettingsTab';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export const Route = createFileRoute('/staff/auto-grading-settings')({
  component: AutoGradingSettingsPage,
});

function AutoGradingSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <WrenchScrewdriverIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Auto-Grading Settings</h1>
        </div>
        <p className="text-sm text-gray-600">
          Configure automatic grading behavior and automation rules
        </p>
      </div>

      {/* Settings Content */}
      <SettingsTab />
    </div>
  );
}
