import { useState } from "react";
import { StrategyBadge, SpeakButton, SectionTitle, SlideCard, ActivityHeader, useActivityAnswer } from "./Shared";
import { playReveal, playClick } from "../utils/audio";

/* ========== الشريحة 10: العاصمة الجديدة ========== */
export function CapitalSlide() {
  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="🏙️">العاصمة الجديدة</SectionTitle>
        <StrategyBadge name="التدريس التبادلي" icon="🔄" />
      </div>
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div className="space-y-4">
          <p className="text-lg leading-loose font-semibold text-slate-800">
            أصبحت <span className="font-extrabold text-rose-700">الرياض</span> عاصمة للدولة السعودية الثانية في عام{" "}
            <span className="font-extrabold text-teal-700">١٢٤٠هـ</span>، وهي مدينة تاريخية عريقة.
          </p>
          <p className="text-lg leading-loose font-semibold text-slate-800">
            أعاد الإمام تركي لها دورها التاريخي، فبنى <span className="bg-amber-200 px-1 rounded">أسوارها</span>، وبنى{" "}
            <span className="bg-amber-200 px-1 rounded">قصر الحكم</span>، و<span className="bg-amber-200 px-1 rounded">مسجداً جامعاً</span> كبيراً بجواره.
          </p>
          <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4">
            <p className="font-extrabold text-teal-800 mb-2">👥 مهمة المجموعات (التدريس التبادلي):</p>
            <ul className="list-disc pr-5 space-y-1 font-semibold text-teal-900 text-sm">
              <li>المجموعة الأولى: تلخّص أعمال الإمام تركي في الرياض.</li>
              <li>المجموعة الثانية: تطرح سؤالاً على بقية المجموعات.</li>
              <li>المجموعة الثالثة: توضّح الكلمات الصعبة.</li>
              <li>المجموعة الرابعة: تتوقع ماذا سيحدث للرياض مستقبلاً.</li>
            </ul>
          </div>
        </div>
        <figure className="rounded-2xl overflow-hidden border-2 border-teal-200 shadow-md">
          <img src="/images/hero-diriyah.jpg" alt="العمارة النجدية التاريخية" className="w-full h-72 object-cover" />
          <figcaption className="bg-teal-700 text-white text-center font-bold py-2.5 text-sm">
            العمارة النجدية التاريخية العريقة
          </figcaption>
        </figure>
      </div>
      <div className="mt-6">
        <SpeakButton text="العاصمة الجديدة. أصبحت الرياض عاصمة للدولة السعودية الثانية في عام ألف ومئتين وأربعين للهجرة، وهي مدينة تاريخية عريقة. أعاد الإمام تركي لها دورها التاريخي، فبنى أسوارها، وبنى قصر الحكم، ومسجداً جامعاً كبيراً بجواره." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 11: نشاط 2 - الأبيات الشعبية ========== */
export function Activity2Slide() {
  const [answer, setAnswer] = useActivityAnswer("نشاط٢-معاني الأبيات");
  const [showModel, setShowModel] = useState(false);
  return (
    <SlideCard>
      <ActivityHeader number="٢" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">استنتاج معاني الأبيات الشعبية</h2>
        <StrategyBadge name="الاستنتاج والتحليل" icon="🔍" />
      </div>
      <p className="font-bold text-slate-700 mb-4">
        وصَف الإمام تركي بن عبدالله حالَه عندما كان يعمل لإعادة تأسيس الدولة السعودية فقال:
      </p>
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 mb-5 text-center space-y-3">
        <p className="font-extrabold text-lg md:text-xl text-amber-950 leading-loose">
          جلسـت فـي غـارٍ علـى الطُّرق كشـافْ <span className="text-amber-500 mx-2">….</span> على طريقٍ نايـفٍ في عِلِيَّـة
        </p>
        <p className="font-extrabold text-lg md:text-xl text-amber-950 leading-loose">
          وطويـق غـربٍ وكاشـفٌ كل الأطــرافْ <span className="text-amber-500 mx-2">….</span> وخذيت بـه وقتٍ ولـه قابلية
        </p>
        <p className="font-extrabold text-lg md:text-xl text-amber-950 leading-loose">
          مع الخـوي الأجرب علـى كل حـوَّافْ <span className="text-amber-500 mx-2">….</span> في يد شجـاعٍ ما تهبِّي ضوية
        </p>
      </div>
      <p className="font-extrabold text-rose-700 mb-3">✍️ يستنتج الطلبة معاني هذه الأبيات الشعبية التي توضح جزءاً من قصة الإمام تركي بن عبدالله:</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="اكتب استنتاجك هنا…"
        rows={3}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 font-semibold focus:border-teal-500 focus:outline-none mb-4"
      />
      <button
        onClick={() => { playReveal(); setShowModel(true); }}
        className="rounded-xl bg-teal-700 text-white font-extrabold px-6 py-3 shadow-md hover:bg-teal-800 transition-colors"
      >
        💡 عرض استنتاج مقترح
      </button>
      {showModel && (
        <div className="mt-4 bg-teal-50 border-2 border-teal-300 rounded-2xl p-5 animate-slidein">
          <p className="font-semibold text-teal-900 leading-loose">
            تصف الأبيات فترة اختباء الإمام تركي في أحد الغيران (الكهوف) على جبل طويق مراقباً الطرق ومتابعاً تحركات الأعداء،
            صابراً منتظراً الفرصة المناسبة، ومعه سيفه الشهير «الأجرب» في يد شجاعة لا تعرف الخوف، حتى تمكّن من استعادة الدولة.
          </p>
        </div>
      )}
      <div className="mt-6">
        <SpeakButton text="نشاط اثنان. وصف الإمام تركي بن عبدالله حاله عندما كان يعمل لإعادة تأسيس الدولة السعودية بأبيات شعبية، يصف فيها اختباءه في غار على جبل طويق، يراقب الطرق ويترقب الفرصة المناسبة، ومعه سيفه الأجرب في يد شجاعة. استنتج مع زملائك معاني هذه الأبيات." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 12: نشاط 3 - مقارنة قصر الحكم ========== */
export function Activity3Slide() {
  const [oldAns, setOldAns] = useActivityAnswer("نشاط٣-قصر الحكم قديماً");
  const [newAns, setNewAns] = useActivityAnswer("نشاط٣-قصر الحكم حديثاً");
  const [showModel, setShowModel] = useState(false);
  return (
    <SlideCard>
      <ActivityHeader number="٣" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">مقارنة قصر الحكم قديماً وحديثاً</h2>
        <StrategyBadge name="المقارنة والتباين" icon="⚖️" />
      </div>
      <p className="font-semibold text-slate-700 leading-loose mb-5">
        لا يزال <span className="font-extrabold text-rose-700">قصر الحكم</span> قائماً إلى هذا اليوم، وقد جرى تطويره،
        وجُعل مقراً لإمارة منطقة الرياض، وبجواره جامع الإمام تركي بن عبدالله.
      </p>
      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div>
          <figure className="rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md mb-3">
            <img src="/images/qasr-old.jpg" alt="قصر الحكم قديماً" className="w-full h-52 object-cover grayscale" />
            <figcaption className="bg-slate-700 text-white text-center font-bold py-2 text-sm">قصر الحكم قديماً</figcaption>
          </figure>
          <textarea
            value={oldAns}
            onChange={(e) => setOldAns(e.target.value)}
            placeholder="قصر الحكم قديماً: …"
            rows={2}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 font-semibold focus:border-teal-500 focus:outline-none text-sm"
          />
        </div>
        <div>
          <figure className="rounded-2xl overflow-hidden border-2 border-teal-300 shadow-md mb-3">
            <img src="/images/qasr-new.jpg" alt="قصر الحكم حديثاً" className="w-full h-52 object-cover" />
            <figcaption className="bg-teal-700 text-white text-center font-bold py-2 text-sm">قصر الحكم حديثاً</figcaption>
          </figure>
          <textarea
            value={newAns}
            onChange={(e) => setNewAns(e.target.value)}
            placeholder="قصر الحكم حديثاً: …"
            rows={2}
            className="w-full rounded-xl border-2 border-dashed border-teal-300 px-4 py-2.5 font-semibold focus:border-teal-500 focus:outline-none text-sm"
          />
        </div>
      </div>
      <button
        onClick={() => { playReveal(); setShowModel(true); }}
        className="rounded-xl bg-teal-700 text-white font-extrabold px-6 py-3 shadow-md hover:bg-teal-800 transition-colors"
      >
        💡 عرض مقارنة مقترحة
      </button>
      {showModel && (
        <div className="mt-4 grid md:grid-cols-2 gap-4 animate-slidein">
          <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-4">
            <p className="font-extrabold text-slate-700 mb-1">قديماً:</p>
            <p className="font-semibold text-slate-600 text-sm leading-relaxed">بُني من الطين واللبن بالطراز النجدي التقليدي، بسيط البناء، وكان مقراً للحكم وإدارة شؤون الدولة.</p>
          </div>
          <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-4">
            <p className="font-extrabold text-teal-800 mb-1">حديثاً:</p>
            <p className="font-semibold text-teal-900 text-sm leading-relaxed">جرى تطويره وترميمه بأحدث التقنيات مع المحافظة على طرازه التاريخي، وأصبح مقراً لإمارة منطقة الرياض ومَعلماً حضارياً.</p>
          </div>
        </div>
      )}
      <div className="mt-6">
        <SpeakButton text="نشاط ثلاثة. لا يزال قصر الحكم قائماً إلى هذا اليوم، وقد جرى تطويره، وجعل مقراً لإمارة منطقة الرياض، وبجواره جامع الإمام تركي بن عبدالله. قارن بين صورتي قصر الحكم قديماً وحديثاً، واكتب ملاحظاتك." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 13: للاطلاع ========== */
const FACTS = [
  { icon: "🌳", text: "يعد الإمام تركي بن عبدالله بن محمد بن سعود من أحفاد الإمام محمد بن سعود مؤسس الدولة السعودية الأولى." },
  { icon: "👑", text: "الإمام تركي بن عبدالله هو جد الملك عبدالعزيز مؤسس المملكة العربية السعودية التي ننعم اليوم برخائها وأمنها واستقرارها." },
  { icon: "🕊️", text: "توفي الإمام تركي بن عبدالله عام ١٢٤٩هـ، وتولى الحكم بعده ابنه الإمام فيصل." },
];

export function FactsSlide() {
  const [opened, setOpened] = useState<boolean[]>(Array(FACTS.length).fill(false));
  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="📖">للاطلاع والإثراء</SectionTitle>
        <StrategyBadge name="التعلم الذاتي" icon="🚀" />
      </div>
      <p className="text-slate-600 font-semibold mb-6">اضغط على كل صندوق لتقرأ معلومة إثرائية ممتعة 👇</p>
      <div className="space-y-4">
        {FACTS.map((f, i) => (
          <button
            key={i}
            onClick={() => {
              if (!opened[i]) {
                playClick();
                setOpened((o) => o.map((v, j) => (j === i ? true : v)));
              }
            }}
            className={`w-full text-right rounded-2xl border-2 p-5 transition-all flex items-center gap-4 ${
              opened[i] ? "bg-rose-50 border-rose-300" : "bg-white border-dashed border-slate-300 hover:border-rose-400 hover:scale-[1.01]"
            }`}
          >
            <span className="text-3xl shrink-0">{opened[i] ? f.icon : "🎁"}</span>
            {opened[i] ? (
              <span className="font-bold text-slate-800 leading-relaxed animate-slidein">{f.text}</span>
            ) : (
              <span className="font-extrabold text-slate-400">معلومة إثرائية {["الأولى", "الثانية", "الثالثة"][i]} — اضغط للكشف</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <SpeakButton text="للاطلاع. أولاً: يعد الإمام تركي بن عبدالله بن محمد بن سعود من أحفاد الإمام محمد بن سعود مؤسس الدولة السعودية الأولى. ثانياً: الإمام تركي بن عبدالله هو جد الملك عبدالعزيز مؤسس المملكة العربية السعودية التي ننعم اليوم برخائها وأمنها واستقرارها. ثالثاً: توفي الإمام تركي بن عبدالله عام ألف ومئتين وتسعة وأربعين للهجرة، وتولى الحكم بعده ابنه الإمام فيصل." />
      </div>
    </SlideCard>
  );
}
