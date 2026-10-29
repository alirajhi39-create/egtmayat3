-- ============================================================
--  استرجاع بيانات الطلاب في Neon
--  شغّله من: Neon Console → SQL Editor → Run
--  ★ لا يحذف أي بيانات — يعرض السجلات ويصلح الفصول فقط
-- ============================================================

-- ١) عرض عدد السجلات الحالية
SELECT COUNT(*) AS "عدد سجلات الطلاب" FROM lesson_progress;

-- ٢) عرض كل الطلاب مع درجاتهم وتقدمهم
SELECT
  COALESCE(tn.student_name, lp.student_name) AS "اسم الطالب",
  COALESCE(tn.class_name,   lp.class_name)   AS "الفصل",
  lp.max_slide  AS "آخر شريحة",
  lp.quiz_score AS "درجة الاختبار",
  lp.quiz_total AS "من",
  lp.activities IS NOT NULL AS "لديه إجابات",
  lp.started_at AS "بدأ في",
  lp.updated_at AS "آخر تحديث"
FROM lesson_progress lp
LEFT JOIN teacher_names tn ON tn.id = lp.id
WHERE lp.lesson_slug = 'saudi-state-2'
ORDER BY lp.updated_at DESC
LIMIT 200;

-- ٣) إصلاح الفصول فقط (لا يمس الأسماء أو الدرجات أو الأنشطة)
UPDATE lesson_progress
SET class_name = '٦/١'
WHERE class_name IN ('٦ / أ', '6 / أ', '6/أ', '6/1', '6 / 1', '٦ / ١', 'أ');

UPDATE lesson_progress
SET class_name = '٦/٢'
WHERE class_name IN ('٦ / ب', '6 / ب', '6/ب', '6/2', '6 / 2', '٦ / ٢', 'ب');

UPDATE teacher_names
SET class_name = '٦/١'
WHERE class_name IN ('٦ / أ', '6 / أ', '6/أ', '6/1', '6 / 1', '٦ / ١', 'أ');

UPDATE teacher_names
SET class_name = '٦/٢'
WHERE class_name IN ('٦ / ب', '6 / ب', '6/ب', '6/2', '6 / 2', '٦ / ٢', 'ب');

-- ٤) التحقق بعد الإصلاح
SELECT class_name AS "الفصل", COUNT(*) AS "عدد الطلاب"
FROM lesson_progress
GROUP BY class_name
ORDER BY class_name;

-- ============================================================
--  ⚠️  استخدام طارئ فقط — لا تنفّذه إلا إذا أردت الحذف
--  احفظ نسخة من نتائج الاستعلام (٢) قبل التنفيذ
-- ============================================================
-- DELETE FROM lesson_progress WHERE lesson_slug = 'saudi-state-2';
-- DELETE FROM teacher_names;
