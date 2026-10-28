import { useEffect, useState } from "react";
import { StrategyBadge, SpeakButton, SectionTitle, SlideCard } from "./Shared";
import { playCorrect, playWrong, playClick, stopAllAudio } from "../utils/audio";
import { recordActivity, updateProgress } from "../lib/progress";
import { warmSounds } from "../utils/soundStore";

type Q = { q: string; options: string[]; answer: number; explain: string };

export const QUESTIONS: Q[] = [
  {
    q: "مؤسس الدولة السعودية الثانية هو:",
    options: ["الإمام محمد بن سعود", "الإمام تركي بن عبدالله", "الإمام فيصل بن تركي", "الإمام عبدالرحمن بن فيصل"],
    answer: 1,
    explain: "الإمام تركي بن عبدالله أعاد تأسيس الدولة السعودية في دورها الثاني عام ١٢٤٠هـ.",
  },
  {
    q: "تأسست الدولة السعودية الثانية عام:",
    options: ["١٢٣٣هـ", "١٢٤٩هـ", "١٢٤٠هـ", "١٣٠٩هـ"],
    answer: 2,
    explain: "أعلن الإمام تركي تأسيس الدولة السعودية الثانية عام ١٢٤٠هـ.",
  },
  {
    q: "عاصمة الدولة السعودية الثانية هي:",
    options: ["الدرعية", "الرياض", "مكة المكرمة", "الأحساء"],
    answer: 1,
    explain: "اتخذ الإمام تركي الرياض عاصمة للدولة السعودية الثانية.",
  },
  {
    q: "من نتائج سقوط الدرعية:",
    options: ["ازدهار التجارة", "بناء الأسوار", "انتشار الفوضى بسبب غياب الدولة", "عودة الاستقرار"],
    answer: 2,
    explain: "بعد سقوط الدرعية انتشرت الفوضى بسبب غياب الدولة، وحُرقت المزارع والكتب.",
  },
  {
    q: "اشتهر الإمام تركي بن عبدالله بسيفه المسمى:",
    options: ["الأجرب", "الصارم", "البتار", "الحسام"],
    answer: 0,
    explain: "من صفات الإمام تركي الشجاعة، وقد اشتهر بسيفه المسمى «الأجرب».",
  },
  {
    q: "المدة بين سقوط الدرعية وتأسيس الدولة السعودية الثانية:",
    options: ["عشرون سنة", "سبع سنوات فقط", "خمسون سنة", "ثلاث سنوات"],
    answer: 1,
    explain: "بعد سبع سنوات فقط من سقوط الدرعية استطاع الإمام تركي استرجاع الدولة.",
  },
  {
    q: "آخر أئمة الدولة السعودية الثانية هو:",
    options: ["الإمام فيصل بن تركي", "الإمام عبدالله بن فيصل", "الإمام تركي بن عبدالله", "الإمام عبدالرحمن بن فيصل"],
    answer: 3,
    explain: "الإمام عبدالرحمن بن فيصل حكم من ١٣٠٧هـ إلى ١٣٠٩هـ وهو آخر أئمتها.",
  },
  {
    q: "قصر الحكم اليوم أصبح:",
    options: ["متحفاً مهجوراً", "مقراً لإمارة منطقة الرياض", "سوقاً تجارياً", "مدرسة"],
    answer: 1,
    explain: "جرى تطوير قصر الحكم وجُعل مقراً لإمارة منطقة الرياض.",
  },
];

export function QuizSlide({ onFinish }: { onFinish: (score: number) => void }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  const q = QUESTIONS[current];

  useEffect(() => {
    warmSounds([
      `voice-slide-13-q${current + 1}`,
      ...(current + 1 < QUESTIONS.length ? [`voice-slide-13-q${current + 2}`] : []),
      "sfx-click",
    ]);
  }, [current]);

  const choose = (i: number) => {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    const correct = i === q.answer;
    if (correct) {
      playCorrect();
      setScore((s) => s + 1);
    } else {
      playWrong();
    }
    recordActivity(`التقويم-س${current + 1}`, `${q.options[i]} ${correct ? "✅ صحيحة" : "❌ خاطئة"}`);
  };

  const next = () => {
    stopAllAudio();
    playClick();
    if (current + 1 < QUESTIONS.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      updateProgress({ quizScore: score, quizTotal: QUESTIONS.length });
      onFinish(score);
    }
  };

  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="📝">التقويم الختامي</SectionTitle>
        <StrategyBadge name="التقويم التفاعلي" icon="🏆" />
      </div>
      <div className="flex items-center justify-between mb-5">
        <span className="font-extrabold text-slate-600">
          السؤال {current + 1} من {QUESTIONS.length}
        </span>
        <span className="rounded-full bg-amber-100 border border-amber-300 px-4 py-1 font-extrabold text-amber-800">
          ⭐ النقاط: {score}
        </span>
      </div>
      <div className="h-2.5 bg-slate-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-l from-teal-500 to-teal-700 rounded-full transition-all duration-500"
          style={{ width: `${((current + (answered ? 1 : 0)) / QUESTIONS.length) * 100}%` }}
        />
      </div>
      <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-5 mb-5">
        <p className="text-lg sm:text-xl font-extrabold text-teal-900">{q.q}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-5">
        {q.options.map((opt, i) => {
          let style = "bg-white border-slate-300 hover:border-teal-500 hover:scale-[1.02]";
          if (answered) {
            if (i === q.answer) style = "bg-teal-100 border-teal-500 text-teal-900";
            else if (i === selected) style = "bg-rose-100 border-rose-500 text-rose-900";
            else style = "bg-white border-slate-200 opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={answered}
              className={`rounded-xl border-2 px-4 sm:px-5 py-3.5 sm:py-4 font-extrabold text-right transition-all flex items-center gap-3 text-sm sm:text-base ${style}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-300 text-sm font-black">
                {["أ", "ب", "ج", "د"][i]}
              </span>
              {opt}
              {answered && i === q.answer && <span className="mr-auto text-xl">✅</span>}
              {answered && i === selected && i !== q.answer && <span className="mr-auto text-xl">❌</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`rounded-xl p-4 mb-5 font-bold animate-slidein ${selected === q.answer ? "bg-teal-50 border border-teal-300 text-teal-900" : "bg-rose-50 border border-rose-300 text-rose-900"}`}>
          {selected === q.answer ? "🎉 أحسنت! إجابة صحيحة. " : "💪 لا بأس، حاول في السؤال القادم. "}
          {q.explain}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {answered && (
          <button
            onClick={next}
            className="rounded-xl bg-rose-700 text-white font-extrabold px-8 py-3 shadow-lg hover:bg-rose-800 transition-colors"
          >
            {current + 1 < QUESTIONS.length ? "السؤال التالي ←" : "🏁 عرض النتيجة النهائية"}
          </button>
        )}
        <SpeakButton key={current} label="استمع للسؤال" variant={`q${current + 1}`} text={`السؤال ${current + 1}: ${q.q} الخيارات هي: ${q.options.join("، ")}`} />
      </div>
    </SlideCard>
  );
}

export function FinaleSlide({ score, total, onRestart }: { score: number; total: number; onRestart: () => void }) {
  const percent = Math.round((score / total) * 100);
  const msg =
    percent >= 90
      ? "ممتاز! أنت مؤرخ صغير بارع 🏆"
      : percent >= 70
      ? "أحسنت! أداء رائع جداً 🌟"
      : percent >= 50
      ? "جيد! راجع الدرس لتتقنه أكثر 💪"
      : "لا بأس! أعد المحاولة وستتحسن بالتأكيد 📚";
  return (
    <SlideCard>
      <div className="text-center py-6">
        <div className="text-7xl mb-4">{percent >= 70 ? "🎉" : percent >= 50 ? "👏" : "💪"}</div>
        <h2 className="text-3xl md:text-4xl font-black text-rose-800 mb-3">انتهى الدرس!</h2>
        <p className="text-xl font-extrabold text-slate-700 mb-6">{msg}</p>
        <div className="inline-flex items-center gap-4 sm:gap-6 bg-teal-50 border-2 border-teal-200 rounded-2xl px-6 sm:px-10 py-5 sm:py-6 mb-8">
          <div>
            <p className="text-4xl sm:text-5xl font-black text-teal-700">{score}/{total}</p>
            <p className="font-bold text-slate-500 mt-1">إجابات صحيحة</p>
          </div>
          <div className="h-16 w-px bg-teal-200" />
          <div>
            <p className="text-4xl sm:text-5xl font-black text-amber-600">{percent}٪</p>
            <p className="font-bold text-slate-500 mt-1">النسبة</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 max-w-2xl mx-auto mb-8 text-right">
          <h3 className="font-extrabold text-amber-900 mb-2">📋 ماذا تعلمنا اليوم؟</h3>
          <ul className="list-disc pr-6 space-y-1 font-semibold text-amber-900 text-sm">
            <li>ما حدث بعد سقوط الدرعية عام ١٢٣٣هـ.</li>
            <li>أسباب عودة الدولة السعودية مرة ثانية.</li>
            <li>الإمام تركي بن عبدالله أسس الدولة السعودية الثانية عام ١٢٤٠هـ وعاصمتها الرياض.</li>
            <li>صفات الإمام تركي: الإيمان، التخطيط، الشجاعة، المواطنة، العدل.</li>
            <li>أئمة الدولة السعودية الثانية الأربعة بالترتيب.</li>
          </ul>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={onRestart}
            className="rounded-xl bg-teal-700 text-white font-extrabold px-8 py-3 shadow-lg hover:bg-teal-800 transition-colors"
          >
            🔄 إعادة الدرس من البداية
          </button>
          <SpeakButton
            label="استمع للخلاصة"
            text={`أحسنتم أعزائي الطلاب. حصلتم على ${score} إجابات صحيحة من ${total}. تعلمنا اليوم أن الإمام تركي بن عبدالله أعاد تأسيس الدولة السعودية الثانية عام ألف ومئتين وأربعين للهجرة، واتخذ الرياض عاصمة لها، وتميز بصفات عظيمة هي الإيمان والتخطيط والشجاعة والمواطنة والعدل. إلى اللقاء في درس جديد.`}
          />
        </div>
      </div>
    </SlideCard>
  );
}
