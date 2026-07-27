export const Taggers = {
  person: (text) => `<persName ref="">${text}</persName>`,
  place: (text) => `<placeName ref="">${text}</placeName>`,
  organization: (text) => `<orgName ref="">${text}</orgName>`,
  thing: (text) => `<name type="object" ref="">${text}</name>`,
  keyword: (text) => `<term ref="">${text}</term>`,

  date: (text) => `<date when="">${text}</date>`,
  bibliography: (text) => `<bibl n="">${text}</bibl>`,

  quote: (text) => `<q source="">${text}</q>`,
  reference: (text) => `<ref target="#n_">${text}</ref>`,
  note: (text) => `<note xml:id="n_">${text}</note>`,
  correction: (text) => `<corr sic="">${text}</corr>`,
  link: (text) => `<ref target="">${text}</ref>`,
  translation: (text) => `<note type="translation" xml:lang="">${text}</note>`,

  page: (text) => `<pb n=""/>${text}`,
  break: (text) => `${text}<br/>`,
  ruler: (text) => `${text}<hr/>`,
  lineBreak: (text) => `${text}<lb/>`
}
