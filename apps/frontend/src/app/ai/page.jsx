import AIPanel from '../../components/AIPanel';

export const metadata = { title: 'AI Insights · Kalemart' };

export default function AIPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Powered by Claude — ask anything about your inventory, get reorder suggestions, or discover combos
        </p>
      </div>
      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <AIPanel />
      </div>
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Example questions</p>
        <ul className="space-y-1 text-sm text-indigo-800">
          <li>→ Which products are most likely to run out this weekend?</li>
          <li>→ What should I restock before a bank holiday?</li>
          <li>→ Which items have the best margin per shelf space?</li>
          <li>→ Suggest a meal deal combo for under £5</li>
        </ul>
      </div>
    </div>
  );
}
