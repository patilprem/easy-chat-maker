import React, { useEffect, useRef, useState } from 'react';

// Web3Forms access keys are meant to be used client-side — this key only
// lets people submit the feedback form, it can't read or manage anything.
const WEB3FORMS_ACCESS_KEY = '1f8beca4-21a0-4483-88e5-6da95e11c5ea';

type Step = 'q1' | 'q2' | 'review' | 'sending' | 'done' | 'error';

const QUESTIONS = {
  q1: 'Hey! 👋 Thanks for trying Easy Chat Maker. What were you trying to make, and how did it go?',
  q2: 'Got it. Anything that felt confusing, broken, or missing?',
};

export const FeedbackWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('q1');
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [step, open]);

  const reset = () => {
    setStep('q1');
    setAnswer1('');
    setAnswer2('');
    setDraft('');
  };

  const submit = async (finalAnswer2: string) => {
    setStep('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: 'New feedback — Easy Chat Maker',
          from_name: 'Easy Chat Maker feedback widget',
          page_url: window.location.href,
          message: `What they were making / how it went:\n${answer1}\n\nConfusing, broken, or missing:\n${finalAnswer2 || '(nothing added)'}`,
          botcheck: '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
      } else {
        setStep('error');
      }
    } catch {
      setStep('error');
    }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (step === 'q1') {
      if (!text) return;
      setAnswer1(text);
      setDraft('');
      setStep('q2');
    } else if (step === 'q2') {
      setAnswer2(text);
      setDraft('');
      submit(text);
    }
  };

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
        />
      )}
      <div className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-6">
        {open && (
        <div className="mb-3 flex h-[420px] w-[calc(100vw-2rem)] max-w-[340px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#10172b] shadow-2xl shadow-black/50 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-[13.5px] font-semibold text-white">Quick feedback</p>
              <p className="text-[11.5px] text-white/40">Goes straight to the team — no signup</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close feedback"
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <ChatBubble from="bot">{QUESTIONS.q1}</ChatBubble>
            {answer1 && <ChatBubble from="user">{answer1}</ChatBubble>}
            {(step === 'q2' || step === 'sending' || step === 'done' || step === 'error') && (
              <ChatBubble from="bot">{QUESTIONS.q2}</ChatBubble>
            )}
            {answer2 && <ChatBubble from="user">{answer2}</ChatBubble>}
            {step === 'sending' && <ChatBubble from="bot">Sending…</ChatBubble>}
            {step === 'done' && (
              <ChatBubble from="bot">Thanks, that really helps! 🎉 We read every single message.</ChatBubble>
            )}
            {step === 'error' && (
              <ChatBubble from="bot">
                Hmm, that didn't send. Mind emailing it to{' '}
                <a href="mailto:hello@easychatmaker.com" className="underline">
                  hello@easychatmaker.com
                </a>{' '}
                instead?
              </ChatBubble>
            )}
          </div>

          {(step === 'q1' || step === 'q2') && (
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={step === 'q2' ? 'Type your reply… (optional)' : 'Type your reply…'}
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={step === 'q1' && !draft.trim()}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-[#00FF87] to-[#60EFFF] px-3.5 py-2.5 text-[13px] font-bold text-[#061116] transition-opacity disabled:opacity-40"
                >
                  {step === 'q2' && !draft.trim() ? 'Skip' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {(step === 'done' || step === 'error') && (
            <div className="border-t border-white/10 p-3">
              <button
                onClick={reset}
                className="w-full rounded-xl bg-white/5 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                Send more feedback
              </button>
            </div>
          )}
        </div>
      )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close feedback chat' : 'Open feedback chat'}
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF] text-2xl shadow-[0_10px_30px_-6px_rgba(0,255,135,0.5)] transition-transform hover:-translate-y-0.5"
        >
          {open ? '✕' : '💬'}
        </button>
      </div>
    </>
  );
};

const ChatBubble: React.FC<{ from: 'bot' | 'user'; children: React.ReactNode }> = ({ from, children }) => (
  <div className={`flex ${from === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
        from === 'user'
          ? 'rounded-br-sm bg-gradient-to-r from-[#00FF87] to-[#60EFFF] text-[#061116]'
          : 'rounded-bl-sm border border-white/10 bg-white/[0.05] text-white/85'
      }`}
    >
      {children}
    </div>
  </div>
);
