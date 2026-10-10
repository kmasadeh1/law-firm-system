import { splitDraft } from '@/lib/draft-sections'
import { isolateNumbers } from '@/lib/bidi'

export type Letterhead = {
  nameEn: string
  nameAr: string
  addressEn: string | null
  addressAr: string | null
  phone: string | null
  email: string | null
}

// The printed document: letterhead, reference block, title, body and a
// closing block that sits at the foot of the last page. Print only - on
// screen the draft is edited as plain text.
//
// Direction: the letterhead is laid out left-to-right on purpose (English
// name on the left, Arabic on the right, as on the firm's paper). The
// document itself is dir="auto", so it takes its direction from its own
// first words - an Arabic draft is RTL whatever the reader's interface
// language. Values filled from the case are isolated (FSI...PDI) when the
// draft is generated, so the browser skips them when choosing that
// direction and punctuation around them stays with the sentence.
//
// The @page rules live here rather than in globals.css because they belong
// to this one document: rendered with it, gone when it is. Later in the
// document than globals.css, so they win over its 12mm default margin.
//
// Sizes: A4 is 297mm tall. The first page has a 16mm top margin (the
// letterhead fills the top of the sheet) and every page a 22mm bottom
// margin, leaving 259mm. The article's min-height is 1mm short of that, so
// a short document fills exactly one page - which is what lets the closing
// block sit at its foot - without spilling onto a blank second one.
const PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 25mm 25mm 22mm;
    @bottom-center {
      content: counter(page) " / " counter(pages);
      font-family: var(--font-source-serif-face, serif), serif;
      font-size: 9pt;
      color: #333;
    }
  }
  @page :first {
    margin-top: 16mm;
    @bottom-center {
      content: none;
    }
  }
}

.draft-doc {
  flex-direction: column;
  min-height: 258mm;
  color: #000;
  font-family: var(--font-source-serif-face, "Source Serif 4"), var(--font-amiri-face, "Amiri"), serif;
}

.draft-incomplete {
  margin-bottom: 4mm;
  padding: 2mm 3mm;
  border: 1.5pt solid #000;
  background: #eee;
  font-family: var(--font-source-serif-face, serif), var(--font-amiri-face, "Amiri"), serif;
  font-size: 10pt;
  line-height: 1.4;
  break-inside: avoid;
}
.draft-incomplete-heading {
  font-weight: 700;
}

.draft-letterhead {
  padding-bottom: 2.5mm;
  border-bottom: 2.5pt double #000;
  font-family: var(--font-amiri-face, "Amiri"), serif;
}
.draft-letterhead-names {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10mm;
}
.draft-letterhead-name {
  font-size: 15pt;
  font-weight: 700;
  line-height: 1.25;
}
.draft-letterhead-name:lang(ar) {
  font-size: 17pt;
}
.draft-letterhead-address {
  margin-top: 0.5mm;
  font-size: 8.5pt;
  line-height: 1.35;
  color: #333;
}
.draft-letterhead-contact {
  margin-top: 1.5mm;
  text-align: center;
  font-size: 8.5pt;
  color: #333;
}

.draft-text {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
}
.draft-text:dir(rtl) {
  font-family: var(--font-amiri-face, "Amiri"), serif;
}

.draft-reference {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 6mm;
  row-gap: 0.6mm;
  margin-top: 8mm;
  font-size: 10.5pt;
  line-height: 1.45;
  break-inside: avoid;
}
.draft-text:dir(rtl) .draft-reference {
  font-size: 12pt;
}
.draft-reference-text {
  grid-column: 1 / -1;
  margin-bottom: 1mm;
  font-weight: 700;
}
.draft-reference-label {
  color: #333;
}

.draft-title {
  margin: 10mm 0 7mm;
  text-align: center;
  font-family: var(--font-amiri-face, "Amiri"), serif;
  font-size: 15pt;
  font-weight: 700;
  line-height: 1.3;
  break-after: avoid;
}

.draft-body {
  font-size: 11.5pt;
  line-height: 1.7;
}
.draft-text:dir(rtl) .draft-body {
  font-size: 13pt;
  line-height: 1.85;
}
.draft-body p {
  margin: 0 0 0.85em;
  white-space: pre-wrap;
  orphans: 3;
  widows: 3;
}

.draft-closing {
  align-self: end;
  min-width: 65mm;
  margin-top: auto;
  padding-top: 12mm;
  font-size: 11.5pt;
  line-height: 1.7;
  break-inside: avoid;
}
.draft-text:dir(rtl) .draft-closing {
  font-size: 13pt;
}
.draft-closing p {
  margin: 0 0 0.6em;
  white-space: pre-wrap;
}
`

export function DraftDocument({
  letterhead,
  title,
  body,
  incomplete,
}: {
  letterhead: Letterhead
  title: string
  body: string
  // Set when the text still holds unfilled-placeholder markers. Printed at
  // the top of the page so an incomplete document is obvious on paper.
  incomplete: { heading: string; items: string[] } | null
}) {
  const sections = splitDraft(body)

  return (
    <article className="draft-doc hidden print:flex" data-testid="draft-print-view">
      <style>{PRINT_CSS}</style>

      {incomplete && (
        <div className="draft-incomplete" data-testid="draft-print-incomplete">
          <p className="draft-incomplete-heading">{incomplete.heading}</p>
          <p>{incomplete.items.join(' | ')}</p>
        </div>
      )}

      <header dir="ltr" className="draft-letterhead" data-testid="draft-letterhead">
        <div className="draft-letterhead-names">
          <div lang="en">
            <p className="draft-letterhead-name" lang="en">
              {letterhead.nameEn}
            </p>
            {letterhead.addressEn && <p className="draft-letterhead-address">{letterhead.addressEn}</p>}
          </div>
          <div dir="rtl" lang="ar">
            <p className="draft-letterhead-name" lang="ar">
              {letterhead.nameAr}
            </p>
            {letterhead.addressAr && <p className="draft-letterhead-address">{letterhead.addressAr}</p>}
          </div>
        </div>
        {(letterhead.phone || letterhead.email) && (
          <p className="draft-letterhead-contact">
            {letterhead.phone && <span dir="ltr">{letterhead.phone}</span>}
            {letterhead.phone && letterhead.email && ' · '}
            {letterhead.email && <span dir="ltr">{letterhead.email}</span>}
          </p>
        )}
      </header>

      <div dir="auto" className="draft-text">
        {sections.reference && (
          <div className="draft-reference" data-testid="draft-reference">
            {sections.reference.map((line, i) =>
              line.kind === 'pair' ? (
                <div key={i} className="contents">
                  <span className="draft-reference-label">{line.label}</span>
                  <span>{isolateNumbers(line.value)}</span>
                </div>
              ) : (
                <p key={i} className="draft-reference-text">
                  {isolateNumbers(line.text)}
                </p>
              )
            )}
          </div>
        )}

        <h1 className="draft-title">{title}</h1>

        <div className="draft-body" data-testid="draft-print-body">
          {sections.body.map((paragraph, i) => (
            <p key={i}>{isolateNumbers(paragraph)}</p>
          ))}
        </div>

        {sections.closing && (
          <div className="draft-closing" data-testid="draft-closing">
            {sections.closing.map((paragraph, i) => (
              <p key={i}>{isolateNumbers(paragraph)}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
