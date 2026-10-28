import { useEffect, useState } from "react";
import { CoverSlide, HookSlide, AftermathSlide, FounderSlide } from "./components/Slides1";
import { ReasonsSlide, Activity1Slide, TimelineSlide, ImamBioSlide, TraitsMatchSlide } from "./components/Slides2";
import { CapitalSlide, Activity2Slide, Activity3Slide, FactsSlide } from "./components/Slides3";
import { QuizSlide, FinaleSlide } from "./components/Quiz";
import { StudentLogin } from "./components/StudentLogin";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { SlideContext } from "./components/Shared";
import { playClick, playSuccess, stopAllAudio } from "./utils/audio";
import { refreshKeys, warmSounds } from "./utils/soundStore";
import { getSession, updateProgress, endSession } from "./lib/progress";

const SLIDE_TITLES = [
  { title: "الغلاف والأهداف", icon: "🏠" },
  { title: "التهيئة", icon: "💡" },
  { title: "بعد سقوط الدرعية", icon: "🃏" },
  { title: "المؤسس الجديد", icon: "🏅" },
  { title: "أسباب العودة", icon: "🗺️" },
  { title: "نشاط ١", icon: "✏️" },
  { title: "أئمة الدولة", icon: "⏳" },
  { title: "الإمام تركي", icon: "⭐" },
  { title: "صفات الإمام", icon: "🔗" },
  { title: "العاصمة الجديدة", icon: "🏙️" },
  { title: "نشاط ٢", icon: "✏️" },
  { title: "نشاط ٣", icon: "✏️" },
  { title: "للاطلاع", icon: "📖" },
  { title: "التقويم", icon: "📝" },
];

const QUIZ_TOTAL = 8;
type View = "login" | "lesson" | "teacher";

export default function App() {
  const [view, setView] = useState<View>(() => (getSession() ? "lesson" : "login"));
  const [slide, setSlide] = useState(() => getSession()?.maxSlide ?? 0);
  const [finished, setFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [student, setStudent] = useState(() => getSession());

  const totalSlides = SLIDE_TITLES.length;

  useEffect(() => {
    if (view === "lesson") updateProgress({ maxSlide: slide, totalSlides });
  }, [slide, view, totalSlides]);

  useEffect(() => {
    if (view !== "lesson") return;
    if (slide === 13 && !finished) return; // الاختبار يهيئ السؤال الحالي والتالي بنفسه
    warmSounds(finished
      ? ["voice-slide-14", "sfx-click"]
      : [`voice-slide-${slide}`, `voice-slide-${slide + 1}`, "sfx-click"]);
  }, [slide, finished, view]);

  useEffect(() => {
    const sync = () => { void refreshKeys(); };
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 30000);
    return () => {
      window.removeEventListener("focus", sync);
      window.clearInterval(timer);
    };
  }, []);

  const go = (n: number) => {
    stopAllAudio();
    playClick();
    setFinished(false);
    setSlide(Math.max(0, Math.min(totalSlides - 1, n)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleQuizFinish = (score: number) => {
    stopAllAudio();
    setFinalScore(score);
    setFinished(true);
    playSuccess();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    stopAllAudio();
    playClick();
    setFinished(false);
    setSlide(0);
    window.scrollTo({ top: 0 });
  };

  const logout = () => {
    stopAllAudio();
    endSession();
    setStudent(null);
    setSlide(0);
    setFinished(false);
    setView("login");
  };

  if (view === "login")
    return (
      <StudentLogin
        onStart={() => { setStudent(getSession()); setSlide(0); setFinished(false); setView("lesson"); }}
        onTeacher={() => { stopAllAudio(); setView("teacher"); }}
      />
    );

  if (view === "teacher")
    return <TeacherDashboard onExit={() => { stopAllAudio(); setView(getSession() ? "lesson" : "login"); }} />;

  const renderSlide = () => {
    if (finished) return <FinaleSlide score={finalScore} total={QUIZ_TOTAL} onRestart={restart} />;
    switch (slide) {
      case 0: return <CoverSlide />;
      case 1: return <HookSlide />;
      case 2: return <AftermathSlide />;
      case 3: return <FounderSlide />;
      case 4: return <ReasonsSlide />;
      case 5: return <Activity1Slide />;
      case 6: return <TimelineSlide />;
      case 7: return <ImamBioSlide />;
      case 8: return <TraitsMatchSlide />;
      case 9: return <CapitalSlide />;
      case 10: return <Activity2Slide />;
      case 11: return <Activity3Slide />;
      case 12: return <FactsSlide />;
      case 13: return <QuizSlide onFinish={handleQuizFinish} />;
      default: return null;
    }
  };

  return (
    <SlideContext.Provider value={finished ? 14 : slide}>
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-50 via-amber-50/40 to-rose-50 font-[Tajawal,Cairo,sans-serif]">
        <header className="sticky top-0 z-40 bg-teal-900/95 backdrop-blur text-white shadow-lg">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-amber-400 text-xl sm:text-2xl shadow">🏰</span>
              <div className="min-w-0">
                <h1 className="font-black text-sm sm:text-lg leading-tight truncate">تأسيس الدولة السعودية الثانية</h1>
                <p className="text-teal-200 text-[10px] sm:text-xs font-bold truncate">
                  أ. علي عبدالله راجحي • مدرسة العروس الابتدائية
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-extrabold shrink-0">
              {student && (
                <span className="hidden sm:inline-block rounded-full bg-amber-400 text-teal-950 px-3 py-1 max-w-40 truncate" title={student.studentName}>
                  👤 {student.studentName}
                </span>
              )}
              <span className="rounded-full bg-white/15 px-2.5 sm:px-3 py-1">
                {finished ? "النتيجة" : `${slide + 1}/${totalSlides}`}
              </span>
              <button onClick={() => { stopAllAudio(); setView("teacher"); }} className="rounded-full bg-white/15 hover:bg-white/25 px-2.5 sm:px-3 py-1" title="لوحة المعلم">
                👨‍🏫
              </button>
              <button onClick={logout} className="rounded-full bg-white/15 hover:bg-rose-500 px-2.5 sm:px-3 py-1" title="إنهاء الجلسة">
                🚪
              </button>
            </div>
          </div>
          {student && (
            <div className="sm:hidden px-3 pb-2 text-[11px] font-extrabold text-amber-300 truncate">
              👤 الطالب: {student.studentName} • الفصل {student.className}
            </div>
          )}
          <div className="h-1.5 bg-teal-950">
            <div
              className="h-full bg-gradient-to-l from-amber-400 to-amber-500 transition-all duration-500"
              style={{ width: `${(((finished ? totalSlides : slide) + 1) / (totalSlides + 1)) * 100}%` }}
            />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
          {!finished && (
            <nav className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-5">
              {SLIDE_TITLES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  title={s.title}
                  className={`rounded-full border-2 transition-all flex items-center gap-1.5 font-extrabold text-xs
                    h-9 w-9 justify-center sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5 ${
                    i === slide
                      ? "bg-rose-700 border-rose-700 text-white shadow-md scale-110 sm:scale-100"
                      : i < slide
                      ? "bg-teal-100 border-teal-300 text-teal-800"
                      : "bg-white border-slate-200 text-slate-500 hover:border-teal-400"
                  }`}
                >
                  <span className="text-sm sm:text-xs">{s.icon}</span>
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
              ))}
            </nav>
          )}

          {renderSlide()}

          {!finished && (
            <div className="flex items-center justify-between mt-5 sm:mt-6 gap-3">
              <button
                onClick={() => go(slide - 1)}
                disabled={slide === 0}
                className="rounded-xl bg-white border-2 border-teal-300 text-teal-800 font-extrabold px-4 sm:px-6 py-3 shadow-sm hover:bg-teal-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                → السابق
              </button>
              <div className="hidden md:flex gap-1.5">
                {SLIDE_TITLES.map((_, i) => (
                  <span key={i} className={`h-2.5 rounded-full transition-all ${i === slide ? "w-8 bg-rose-700" : "w-2.5 bg-slate-300"}`} />
                ))}
              </div>
              {slide < totalSlides - 1 ? (
                <button
                  onClick={() => go(slide + 1)}
                  className="rounded-xl bg-rose-700 text-white font-extrabold px-5 sm:px-8 py-3 shadow-lg hover:bg-rose-800 hover:scale-105 transition-all text-sm sm:text-base"
                >
                  التالي ←
                </button>
              ) : (
                <span className="rounded-xl bg-amber-100 border border-amber-300 text-amber-800 font-extrabold px-3 sm:px-6 py-3 text-xs sm:text-sm text-center">
                  أكمل الاختبار لإنهاء الدرس 🏁
                </span>
              )}
            </div>
          )}
        </main>

        <footer className="text-center pb-8 pt-2 text-slate-500 font-bold text-sm">
          🇸🇦 الوحدة الثالثة • الدرس السابع — درس تفاعلي بالاستراتيجيات والأصوات والتعليق الصوتي
        </footer>
      </div>
    </SlideContext.Provider>
  );
}
