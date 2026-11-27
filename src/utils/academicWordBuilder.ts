import { AcademicWordStyle, WordDocumentData } from '../types/editor';
import { TemplateMetadata } from './templateBuilders';

export interface AcademicDocChapterSection {
  code?: string;
  title: string;
  paragraphs: string[];
}

export interface AcademicDocChapter {
  code?: string;
  title: string;
  sections: AcademicDocChapterSection[];
}

export interface GeneratedAcademicDocData {
  docKind?: 'independent_work' | 'course_work' | 'essay_article';
  title?: string;
  subtitle?: string;
  ministryHeader?: string;
  abstract?: string;
  keywords?: string[];
  topicImages?: string[];
  planOutline?: Array<{ code?: string; title: string }>;
  introduction?: {
    relevance?: string;
    priorResearch?: string;
    goal?: string;
    tasks?: string[];
    object?: string;
    subjectMatter?: string;
    methods?: string;
  };
  chapters?: AcademicDocChapter[];
  comparisonTable?: {
    caption?: string;
    headers?: string[];
    rows?: string[][];
  };
  conclusion?: string[];
  references?: string[];
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIndentedParagraph(text: string, justify = true): string {
  const clean = text.trim();
  if (!clean) return '';
  return `<p style="text-align:${justify ? 'justify' : 'left'};text-indent:1.25cm;line-height:1.5;margin:0 0 8pt 0;">${escapeHtml(clean)}</p>`;
}

function renderTopicFigure(src: string, figNumber: number, captionText: string): string {
  const safeCaption = escapeHtml(captionText.trim() || "Mavzuga oid illyustrativ tasvir");
  return [
    `<figure class="doc-figure" style="margin:14pt 0 14pt 0;text-align:center;">`,
    `<p style="text-align:center;margin:0 0 6pt 0;"><img src="${src}" alt="${safeCaption}" style="max-width:86%;max-height:280px;width:auto;height:auto;display:inline-block;border-radius:4px;" /></p>`,
    `<p style="text-align:center;font-style:italic;font-size:11pt;color:#475569;margin:0;">${figNumber}-rasm. ${safeCaption}</p>`,
    `</figure>`,
  ].join('');
}

export function buildAcademicWordDocument(
  data: GeneratedAcademicDocData,
  meta: TemplateMetadata,
  serviceId: 'independent_work_word' | 'course_work_word' | 'essay_article_word',
  style: AcademicWordStyle = 'classic_otm'
): { wordDoc: WordDocumentData; docTitle: string } {
  const docTitle = (data.title || 'Ilmiy ish').trim();
  const isCourseWork = serviceId === 'course_work_word';
  const isEssayOrArticle = serviceId === 'essay_article_word';

  const ministry = (
    data.ministryHeader ||
    "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI"
  ).toUpperCase();
  const institution = (meta.institution || "Oliy ta'lim muassasasi").trim();
  const faculty = (meta.faculty || '').trim();
  const department = (meta.department || '').trim();
  const subject = (meta.subject || '').trim();
  const course = (meta.course || '').trim();
  const groupName = (meta.groupName || '').trim();
  const authorName = (meta.authorName || '__________________').trim();
  const teacher = (meta.teacher || '__________________').trim();
  const city = (meta.city || 'Toshkent').trim();
  const academicYear = (meta.academicYear || '2025–2026').trim();

  const topicImages = Array.isArray(data.topicImages)
    ? data.topicImages.filter((src) => typeof src === 'string' && src.trim().length > 0)
    : [];

  const workTypeTitle = isCourseWork
    ? 'KURS ISHI'
    : isEssayOrArticle
      ? style === 'analytical_essay'
        ? 'TAHLILIY ESSE'
        : style === 'conference_thesis'
          ? 'ILMIY TEZIS'
          : 'ILMIY MAQOLA'
      : 'MUSTAQIL ISH';

  const parts: string[] = [];

  if (isEssayOrArticle) {
    // Editorial / Journal Header for Essay / Article / Thesis
    const accentHex = style === 'imrad_journal' ? '#1E3A8A' : style === 'conference_thesis' ? '#0F766E' : '#111827';
    if (institution || faculty || department) {
      parts.push(
        `<p style="text-align:center;font-size:11pt;color:#475569;margin:0 0 6pt 0;line-height:1.35;">${escapeHtml(
          [institution, faculty, department].filter(Boolean).join(' • ')
        )}</p>`
      );
    }
    parts.push(
      `<p style="text-align:center;font-size:10.5pt;font-weight:bold;letter-spacing:1px;color:${accentHex};margin:0 0 8pt 0;">${escapeHtml(workTypeTitle)}${subject ? ` · ${escapeHtml(subject.toUpperCase())}` : ''}</p>`
    );
    parts.push(
      `<h1 style="text-align:center;color:${accentHex};margin:0 0 10pt 0;line-height:1.25;">${escapeHtml(docTitle)}</h1>`
    );
    if (data.subtitle) {
      parts.push(
        `<p style="text-align:center;font-style:italic;color:#334155;margin:0 0 12pt 0;">${escapeHtml(data.subtitle)}</p>`
      );
    }

    const authorLines: string[] = [];
    if (authorName) authorLines.push(`<strong>Muallif:</strong> ${escapeHtml(authorName)}`);
    if (course) authorLines.push(`<strong>Kurs:</strong> ${escapeHtml(course)}`);
    if (groupName) authorLines.push(`<strong>Guruh:</strong> ${escapeHtml(groupName)}`);
    if (teacher) authorLines.push(`<strong>Ilmiy rahbar:</strong> ${escapeHtml(teacher)}`);
    if (authorLines.length > 0) {
      parts.push(
        `<p style="text-align:center;font-size:12pt;color:#1E293B;margin:0 0 14pt 0;line-height:1.45;">${authorLines.join(' &nbsp;|&nbsp; ')}</p>`
      );
    }

    if (data.abstract) {
      parts.push(
        `<p style="text-align:justify;line-height:1.45;margin:0 0 8pt 0;"><strong>Annotatsiya.</strong> ${escapeHtml(data.abstract)}</p>`
      );
    }
    if (Array.isArray(data.keywords) && data.keywords.length > 0) {
      parts.push(
        `<p style="text-align:left;line-height:1.45;margin:0 0 14pt 0;"><strong>Kalit so'zlar:</strong> <em>${escapeHtml(data.keywords.join(', '))}</em></p>`
      );
    }
    parts.push('<hr />');
  } else {
    // Formal Uzbekistan OTM Full-Page Titul Varag'i (Mustaqil ish / Kurs ishi)
    const isFramed = style === 'framed_academic';
    const isModern = style === 'modern_university';
    const accentHex = isModern ? '#1E3A8A' : '#0F172A';

    const titulTop: string[] = [];
    if (isFramed) {
      titulTop.push('<hr />');
    }
    titulTop.push(
      `<p style="text-align:center;font-weight:bold;line-height:1.4;margin:0 0 6pt 0;color:${accentHex};">${escapeHtml(ministry)}</p>`
    );
    titulTop.push(
      `<p style="text-align:center;font-weight:bold;line-height:1.4;margin:0 0 10pt 0;color:${accentHex};">${escapeHtml(institution.toUpperCase())}</p>`
    );
    if (faculty) {
      titulTop.push(
        `<p style="text-align:center;line-height:1.4;margin:0 0 4pt 0;"><strong>Fakultet:</strong> ${escapeHtml(faculty)}</p>`
      );
    }
    if (department) {
      titulTop.push(
        `<p style="text-align:center;line-height:1.4;margin:0 0 4pt 0;"><strong>Kafedra:</strong> ${escapeHtml(department)}</p>`
      );
    }
    if (subject) {
      titulTop.push(
        `<p style="text-align:center;line-height:1.4;margin:0 0 8pt 0;"><strong>Fan:</strong> ${escapeHtml(subject)}</p>`
      );
    }

    const titulCenter: string[] = [];
    titulCenter.push(
      `<h1 style="text-align:center;font-weight:bold;font-size:26pt;color:${accentHex};letter-spacing:2px;margin:0 0 14pt 0;">${escapeHtml(workTypeTitle)}</h1>`
    );
    titulCenter.push(
      `<p style="text-align:center;font-weight:bold;font-size:15pt;line-height:1.4;margin:0 0 8pt 0;">Mavzu: ${escapeHtml(docTitle)}</p>`
    );
    if (data.subtitle) {
      titulCenter.push(
        `<p style="text-align:center;font-style:italic;color:#334155;margin:0 0 36pt 0;">${escapeHtml(data.subtitle)}</p>`
      );
    } else {
      titulCenter.push('<p style="margin:0 0 36pt 0;">&nbsp;</p>');
    }

    const rightBlockLines: string[] = [];
    rightBlockLines.push(`<strong>Bajaruvchi:</strong> ${escapeHtml(authorName)}`);
    if (course) {
      rightBlockLines.push(`<strong>Kurs:</strong> ${escapeHtml(course)}`);
    }
    if (groupName) {
      rightBlockLines.push(`<strong>Guruh:</strong> ${escapeHtml(groupName)}`);
    }
    rightBlockLines.push(
      `<strong>${isCourseWork ? 'Ilmiy rahbar' : 'Tekshiruvchi'}:</strong> ${escapeHtml(teacher)}`
    );

    rightBlockLines.forEach((line) => {
      titulCenter.push(
        `<p style="text-align:right;line-height:1.55;margin:0 0 5pt 0;">${line}</p>`
      );
    });

    const titulBottom: string[] = [];
    titulBottom.push(
      `<p style="text-align:center;font-weight:bold;margin:0 0 4pt 0;">${escapeHtml(city)} – ${escapeHtml(academicYear)}</p>`
    );
    if (isFramed) {
      titulBottom.push('<hr />');
    }

    parts.push(
      `<div class="doc-titul-page" style="min-height:1015px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">` +
        `<div class="doc-titul-top">${titulTop.join('')}</div>` +
        `<div class="doc-titul-center" style="margin:auto 0;padding:24px 0;">${titulCenter.join('')}</div>` +
        `<div class="doc-titul-bottom">${titulBottom.join('')}</div>` +
      `</div>`
    );

    // Hard page break after Titul page
    parts.push('<hr class="doc-page-break" />');

    // REJA / MUNDARIJA (dedicated page)
    const tocLines: string[] = [];
    tocLines.push('<h2 style="text-align:center;margin:0 0 16pt 0;">MUNDARIJA</h2>');
    tocLines.push('<p style="text-align:left;line-height:1.65;margin:0 0 6pt 0;"><strong>KIRISH</strong></p>');
    const outline = Array.isArray(data.planOutline) ? data.planOutline : [];
    if (outline.length > 0) {
      outline.forEach((item) => {
        const prefix = item.code ? `${escapeHtml(item.code)} ` : '';
        tocLines.push(
          `<p style="text-align:left;line-height:1.65;margin:0 0 6pt 0;">${prefix}${escapeHtml(item.title)}</p>`
        );
      });
    } else if (Array.isArray(data.chapters)) {
      data.chapters.forEach((ch, idx) => {
        const chCode = ch.code || `${idx + 1}-bob.`;
        tocLines.push(
          `<p style="text-align:left;line-height:1.65;margin:6pt 0 3pt 0;"><strong>${escapeHtml(chCode)} ${escapeHtml(ch.title)}</strong></p>`
        );
        (ch.sections || []).forEach((sec, sIdx) => {
          const secCode = sec.code || `${idx + 1}.${sIdx + 1}.`;
          tocLines.push(
            `<p style="text-align:left;line-height:1.65;margin:0 0 3pt 18pt;">${escapeHtml(secCode)} ${escapeHtml(sec.title)}</p>`
          );
        });
      });
    }
    tocLines.push('<p style="text-align:left;line-height:1.65;margin:6pt 0 6pt 0;"><strong>XULOSA</strong></p>');
    tocLines.push(
      '<p style="text-align:left;line-height:1.65;margin:0 0 8pt 0;"><strong>FOYDALANILGAN ADABIYOTLAR RO\'YXATI</strong></p>'
    );

    parts.push(`<div class="doc-toc-page" style="min-height:920px;box-sizing:border-box;">${tocLines.join('')}</div>`);
    parts.push('<hr class="doc-page-break" />');
  }

  // KIRISH
  const intro = data.introduction || {};
  parts.push('<h2 style="text-align:center;margin:0 0 10pt 0;">KIRISH</h2>');
  if (intro.relevance) {
    parts.push(renderIndentedParagraph(`Mavzuning dolzarbligi. ${intro.relevance}`));
  }
  if (intro.priorResearch) {
    parts.push(renderIndentedParagraph(`Muammoning o'rganilganlik darajasi. ${intro.priorResearch}`));
  }
  if (intro.goal) {
    parts.push(renderIndentedParagraph(`Tadqiqot maqsadi. ${intro.goal}`));
  }
  if (Array.isArray(intro.tasks) && intro.tasks.length > 0) {
    parts.push(
      renderIndentedParagraph("Qo'yilgan maqsadga erishish uchun quyidagi asosiy vazifalar belgilandi:")
    );
    parts.push('<ul>');
    intro.tasks.forEach((task) => {
      if (task && task.trim()) {
        parts.push(`<li style="text-align:justify;line-height:1.5;">${escapeHtml(task.trim())}</li>`);
      }
    });
    parts.push('</ul>');
  }
  if (intro.object || intro.subjectMatter || intro.methods) {
    const methodLine = [
      intro.object ? `Tadqiqot obyekti: ${intro.object}` : '',
      intro.subjectMatter ? `Tadqiqot predmeti: ${intro.subjectMatter}` : '',
      intro.methods ? `Tadqiqot metodlari: ${intro.methods}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (methodLine) {
      parts.push(renderIndentedParagraph(methodLine));
    }
  }

  // CHAPTERS / SECTIONS + EMBEDDED TOPIC FIGURES
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  let figureIndex = 0;

  chapters.forEach((chapter, cIdx) => {
    const chapterHeading = `${chapter.code ? `${chapter.code}. ` : `${cIdx + 1}-BOB. `}${chapter.title}`;
    parts.push(
      `<h2 style="text-align:center;margin:16pt 0 10pt 0;">${escapeHtml(chapterHeading.toUpperCase())}</h2>`
    );
    const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
    sections.forEach((sec, sIdx) => {
      const secHeading = `${sec.code ? `${sec.code}. ` : `${cIdx + 1}.${sIdx + 1}. `}${sec.title}`;
      parts.push(`<h3 style="text-align:left;margin:12pt 0 8pt 0;">${escapeHtml(secHeading)}</h3>`);
      (sec.paragraphs || []).forEach((p) => {
        if (p && p.trim()) {
          parts.push(renderIndentedParagraph(p));
        }
      });
      // Place topic image neatly after the first section of each chapter (up to available photos)
      if (sIdx === 0 && figureIndex < topicImages.length) {
        const imgSrc = topicImages[figureIndex];
        figureIndex += 1;
        parts.push(renderTopicFigure(imgSrc, figureIndex, `${sec.title || chapter.title} — vizual illyustratsiya`));
      }
    });
  });

  // If any extra fetched image remains and wasn't placed in chapters, place before Comparison Table / Conclusion
  if (figureIndex < topicImages.length) {
    const imgSrc = topicImages[figureIndex];
    figureIndex += 1;
    parts.push(renderTopicFigure(imgSrc, figureIndex, `${docTitle} — amaliy tasvir`));
  }

  // ANALYTICAL COMPARISON TABLE (if supplied)
  const tbl = data.comparisonTable;
  if (tbl && Array.isArray(tbl.headers) && tbl.headers.length > 0 && Array.isArray(tbl.rows) && tbl.rows.length > 0) {
    if (tbl.caption) {
      parts.push(
        `<p style="text-align:right;font-style:italic;margin:10pt 0 4pt 0;">${escapeHtml(tbl.caption)}</p>`
      );
    }
    parts.push('<table><thead><tr>');
    tbl.headers.forEach((h) => {
      parts.push(`<th>${escapeHtml(h)}</th>`);
    });
    parts.push('</tr></thead><tbody>');
    tbl.rows.forEach((row) => {
      if (Array.isArray(row) && row.length > 0) {
        parts.push('<tr>');
        tbl.headers!.forEach((_, idx) => {
          parts.push(`<td>${escapeHtml(row[idx] ?? '')}</td>`);
        });
        parts.push('</tr>');
      }
    });
    parts.push('</tbody></table>');
  }

  // CONCLUSION
  const conclusion = Array.isArray(data.conclusion) ? data.conclusion : [];
  if (conclusion.length > 0) {
    parts.push('<h2 style="text-align:center;margin:18pt 0 10pt 0;">XULOSA</h2>');
    conclusion.forEach((p) => {
      if (p && p.trim()) {
        parts.push(renderIndentedParagraph(p));
      }
    });
  }

  // REFERENCES
  const refs = Array.isArray(data.references) ? data.references : [];
  if (refs.length > 0) {
    if (!isEssayOrArticle) {
      parts.push('<hr class="doc-page-break" />');
    }
    parts.push(
      '<h2 style="text-align:center;margin:16pt 0 10pt 0;">FOYDALANILGAN ADABIYOTLAR RO\'YXATI</h2>'
    );
    parts.push('<ol>');
    refs.forEach((ref) => {
      if (ref && ref.trim()) {
        parts.push(`<li style="text-align:justify;line-height:1.5;margin-bottom:5pt;">${escapeHtml(ref.trim())}</li>`);
      }
    });
    parts.push('</ol>');
  }

  return {
    docTitle,
    wordDoc: {
      html: parts.join('\n'),
      fontFamily: 'Times New Roman, Times, serif',
      fontSize: 16,
      marginPreset: 'gost_academic',
    },
  };
}
