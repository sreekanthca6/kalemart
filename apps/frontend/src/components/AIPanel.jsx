'use client';
import { useState } from 'react';
import { api } from '../lib/api';

export default function AIPanel() {
  const [question, setQuestion]   = useState('');
  const [answer, setAnswer]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [mode, setMode]           = useState('ask'); // 'ask' | 'reorder' | 'combos'
  const [comboIds, setComboIds]   = useState('');
  const [error, setError]         = useState(null);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true); setError(null); setAnswer(null);
    try {
      const res = await api.askAI(question, '');
      setAnswer(res.insight);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReorder() {
    setLoading(true); setError(null); setAnswer(null);
    try {
      const res = await api.getReorderSuggestions();
      setAnswer(res.suggestions ?? JSON.stringify(res, null, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCombos(e) {
    e.preventDefault();
    const ids = comboIds.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setLoading(true); setError(null); setAnswer(null);
    try {
      const res = await api.getCombos(ids);
      setAnswer(res.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-2">
        {[
          { id: 'ask',    label: 'Ask a Question' },
          { id: 'reorder',label: 'Reorder Suggestions' },
          { id: 'combos', label: 'Combo Picks' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setMode(tab.id); setAnswer(null); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === tab.id
                ? 'bg-brand text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ask a question */}
      {mode === 'ask' && (
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. Which products expire soonest? What should I promote this weekend?"
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            Ask Claude
          </button>
        </form>
      )}

      {/* Reorder suggestions */}
      {mode === 'reorder' && (
        <button
          onClick={handleReorder}
          disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Analysing stock…' : '✦  Generate Reorder Suggestions'}
        </button>
      )}

      {/* Combo picks */}
      {mode === 'combos' && (
        <form onSubmit={handleCombos} className="flex gap-2">
          <input
            type="text"
            value={comboIds}
            onChange={e => setComboIds(e.target.value)}
            placeholder="Product IDs comma-separated, e.g. prod_001, prod_003"
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={loading || !comboIds.trim()}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            Get Combos
          </button>
        </form>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-indigo-600 animate-pulse">
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
          Claude is thinking…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">✦ Claude</p>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">{answer}</pre>
        </div>
      )}
    </div>
  );
}
