'use client';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Other'];

function AttendPage() {
  const params     = useSearchParams();
  const sessionId  = params.get('sessionId');
  const token      = params.get('token');
  const type       = params.get('type') || 'checkin';
  const isCheckout = type === 'checkout';

  // step: 'verifying' | 'form' | 'done' | 'error'
  const [step, setStep]           = useState('verifying');
  const [submitToken, setSubmitToken] = useState('');
  const [timeLeft, setTimeLeft]   = useState(120);
  const [form, setForm]           = useState({ name: '', email: '', department: '' });
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(false);

  function getFingerprint() {
    const raw = navigator.userAgent + screen.width + screen.height + navigator.language;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return String(Math.abs(hash));
  }

  // Step 1 — verify scan token immediately on page load
  useEffect(() => {
    if (!sessionId || !token) {
      setStep('error');
      setStatus({ msg: 'Invalid QR code link.' });
      return;
    }
    fetch('/api/session/verify-scan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId, token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.submitToken) {
          setSubmitToken(data.submitToken);
          setTimeLeft(data.expiresIn); // 120s
          setStep('form');
        } else {
          setStep('error');
          setStatus({ msg: data.error });
        }
      })
      .catch(() => {
        setStep('error');
        setStatus({ msg: 'Network error. Please try again.' });
      });
  }, []);

  // Countdown timer for submit window
  useEffect(() => {
    if (step !== 'form') return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          setStep('error');
          setStatus({ msg: 'Time expired. Please scan the QR code again.' });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Step 2 — submit form with submitToken
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const fingerprint = getFingerprint();
    const endpoint    = isCheckout ? '/api/attendance/checkout' : '/api/attendance/checkin';
    const body        = isCheckout
      ? { sessionId, submitToken, email: form.email, fingerprint }
      : { sessionId, submitToken, ...form, fingerprint };

    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('done');
        setStatus({ msg: data.message });
      } else {
        setStatus({ msg: data.error });
      }
    } catch {
      setStatus({ msg: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">📋 Mark Attendance</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isCheckout ? 'Scan to confirm you stayed till the end.' : 'Fill in your details to check in.'}
          </p>
          <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold
            ${isCheckout ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            {isCheckout ? '🟡 Check-Out' : '🟢 Check-In'}
          </span>
        </div>

        {/* Verifying scan */}
        {step === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Verifying QR code...</p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">❌</div>
            <p className="text-red-600 font-semibold">{status?.msg}</p>
            <p className="text-slate-400 text-sm mt-2">Please scan the QR code on the screen again.</p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">{isCheckout ? '🙌' : '✅'}</div>
            <p className="text-green-700 font-semibold text-lg">{status?.msg}</p>
            <p className="text-slate-500 text-sm mt-2">You can close this page now.</p>
          </div>
        )}

        {/* Form */}
        {step === 'form' && (
          <>
            {/* Countdown */}
            <div className="mb-4 flex items-center justify-between bg-indigo-50 rounded-lg px-4 py-2">
              <span className="text-xs text-indigo-600 font-medium">⏱ Time to submit</span>
              <span className={`text-sm font-bold ${timeLeft <= 30 ? 'text-red-500' : 'text-indigo-600'}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isCheckout && (
                <>
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="email"
                    placeholder="College Email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <select
                    required
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-600"
                  >
                    <option value="">-- Select Department --</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </>
              )}

              {isCheckout && (
                <input
                  type="email"
                  placeholder="Your College Email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Submitting...' : isCheckout ? 'Check Out 👋' : 'Check In ✅'}
              </button>

              {status && (
                <div className="rounded-lg p-3 text-sm font-medium bg-red-50 text-red-700">
                  {status.msg}
                </div>
              )}
            </form>
          </>
        )}

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>
    }>
      <AttendPage />
    </Suspense>
  );
}
