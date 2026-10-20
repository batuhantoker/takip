import { describe, expect, it } from 'vitest';
import { columnOf, fontColours, sharedStrings, sheetParts, sheetRows, unescapeXml } from './xlsx';

// Cut from SIPRI-Milex-data-1949-2025_v1.2.xlsx: its first fonts and cell formats, and cells of the Algeria and Libya rows.
const STYLES = `<styleSheet><numFmts count="3"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><fonts count="14" x14ac:knownFonts="1">`
  + `<font><sz val="11"/><color indexed="8"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>`
  + `<font><sz val="10"/><color indexed="10"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><sz val="10"/><color indexed="12"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><b/><sz val="14"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><sz val="10"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><b/><sz val="10"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><sz val="11"/><color indexed="8"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>`
  + `<font><sz val="10"/><color indexed="8"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><sz val="11"/><color indexed="8"/><name val="Times New Roman"/><family val="1"/></font>`
  + `<font><sz val="10"/><color rgb="FFFF0000"/><name val="Times New Roman"/><family val="1"/></font></fonts>`
  + `<fills count="2"><fill><patternFill patternType="none"/></fill></fills><cellXfs count="33">`
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="1" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="1" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
  + `<xf numFmtId="1" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
  + `<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
  + `<xf numFmtId="10" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="10" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
  + `<xf numFmtId="10" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="0" fontId="10" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="8" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
  + `<xf numFmtId="164" fontId="7" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="10" fontId="9" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>`;

/** Shared strings 0–8, in place of the workbook's 44, 46, 47, 49, 50, 34, 51, 6 (`<t/>`) and 17. */
const STRINGS = `<sst count="29824" uniqueCount="579"><si><t>Country</t></si><si><t>Notes</t></si><si><t>Algeria</t></si><si><t>§4</t></si>`
  + `<si><t>xxx</t></si><si><t>...</t></si><si><t>Libya</t></si><si><t/></si><si><t>Africa</t></si></sst>`;

/** "Constant (2024) US$" rows 6, 10 and 11, a few cells each (string indices renumbered as above). */
const SHEET = `<worksheet><sheetData>`
  + `<row r="6" spans="1:80" ht="18" x14ac:dyDescent="0.2"><c r="A6" s="3" t="s"><v>0</v></c><c r="B6" s="3" t="s"><v>7</v></c><c r="C6" s="3" t="s"><v>1</v></c>`
  + `<c r="D6" s="3"><v>1949</v></c><c r="Q6" s="3"><v>1962</v></c><c r="S6" s="3"><v>1964</v></c><c r="X6" s="3"><v>1969</v></c><c r="BT6" s="3"><v>2017</v></c></row>`
  + `<row r="8" spans="1:80" ht="18" x14ac:dyDescent="0.2"><c r="A8" s="3" t="s"><v>8</v></c></row>`
  + `<row r="10" spans="1:80" x14ac:dyDescent="0.15"><c r="A10" s="15" t="s"><v>2</v></c><c r="C10" s="15" t="s"><v>3</v></c><c r="D10" s="19" t="s"><v>4</v></c>`
  + `<c r="Q10" s="19" t="s"><v>5</v></c><c r="X10" s="9"><v>293.39803759652335</v></c><c r="BT10" s="10"><v>12094.810557680297</v></c></row>`
  + `<row r="11" spans="1:80" x14ac:dyDescent="0.15"><c r="A11" s="15" t="s"><v>6</v></c><c r="D11" s="19" t="s"><v>4</v></c><c r="S11" s="11"><v>41.695829601149626</v></c></row>`
  + `</sheetData></worksheet>`;

describe('xlsx', () => {
  it('reads shared strings, empty and rich ones included', () => {
    expect(sharedStrings(STRINGS)).toEqual(['Country', 'Notes', 'Algeria', '§4', 'xxx', '...', 'Libya', '', 'Africa']);
    expect(sharedStrings('<si><r><rPr><b/></rPr><t xml:space="preserve">Côte </t></r><r><t>d&apos;Ivoire</t></r><rPh><t>x</t></rPh></si>')).toEqual(["Côte d'Ivoire"]);
  });

  it('gives each cell format its font colour', () => {
    const colours = fontColours(STYLES);
    expect(colours.slice(9, 12)).toEqual([null, 'indexed:10', 'indexed:12']);
    expect(colours[15]).toBe('indexed:8');
    expect(colours[20]).toBe('rgb:FFFF0000');
  });

  it('reads rows by column, with numbers as written and strings resolved', () => {
    const rows = [...sheetRows(SHEET, sharedStrings(STRINGS), fontColours(STYLES))];
    expect(rows.map(r => r.r)).toEqual([6, 8, 10, 11]);
    const algeria = rows[2].cells;
    expect(algeria.get(1)).toEqual({ v: 'Algeria', num: false, colour: 'indexed:8' });
    expect(algeria.get(3)?.v).toBe('§4');
    expect(algeria.get(4)).toEqual({ v: 'xxx', num: false, colour: 'indexed:8' });
    expect(algeria.get(24)).toEqual({ v: '293.39803759652335', num: true, colour: null });
    expect(algeria.get(72)).toEqual({ v: '12094.810557680297', num: true, colour: 'indexed:10' });
    expect(rows[3].cells.get(19)).toEqual({ v: '41.695829601149626', num: true, colour: 'indexed:12' });
    expect(rows[0].cells.has(2)).toBe(false);
  });

  it('finds sheets by name through the workbook relationships', () => {
    const workbook = `<sheets><sheet name="Constant (2024) US$" sheetId="5" r:id="rId5"/><sheet name="Share of Govt. spending" sheetId="9" r:id="rId9"/></sheets>`;
    const rels = `<Relationship Id="rId9" Type="…/worksheet" Target="worksheets/sheet9.xml"/><Relationship Id="rId5" Type="…/worksheet" Target="worksheets/sheet5.xml"/>`;
    expect([...sheetParts(workbook, rels)]).toEqual([['Constant (2024) US$', 'xl/worksheets/sheet5.xml'], ['Share of Govt. spending', 'xl/worksheets/sheet9.xml']]);
  });

  it('numbers columns and decodes entities', () => {
    expect([columnOf('A6'), columnOf('BT10'), columnOf('CA1')]).toEqual([1, 72, 79]);
    expect(unescapeXml('Bosnia &amp; Herzegovina &#8211; &#x2014;')).toBe('Bosnia & Herzegovina – —');
  });
});
