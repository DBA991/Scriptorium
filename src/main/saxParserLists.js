import sax from 'sax';
import { Taggers } from '../renderer/src/shared/tei/tags.js';
class SaxParserLists {
  constructor() {
    this.progressCallback = null;
  }
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }
  emitProgress(progress, message) {
    if (this.progressCallback) {
      this.progressCallback(progress, message);
    }
  }
  async extractTeiTerms(xmlFiles, options = {}) {
    const {
      elements = Object.keys(this.getElementTypesFromTaggers())
    } = options;
    this.emitProgress(0, 'Inizializzazione...');
    const results = {};
    elements.forEach(elem => {
      results[elem] = new Map();
    });
    const totalFiles = xmlFiles.length;
    let processedFiles = 0;
    for (const file of xmlFiles) {
      this.emitProgress(Math.round(processedFiles / totalFiles * 80), `Elaborazione ${file.name}...`);
      await this.parseFileForTerms(file, elements, results);
      processedFiles++;
    }
    this.emitProgress(90, 'Ordinamento risultati...');
    const orderedResults = {};
    for (const [elementType, termsMap] of Object.entries(results)) {
      orderedResults[elementType] = Array.from(termsMap.values()).map(data => ({
        id: data.id,
        term: data.term,
        terms: data.terms,
        count: data.count,
        files: Array.from(data.files)
      })).sort((a, b) => a.term.localeCompare(b.term));
    }
    this.emitProgress(100, 'Completato!');
    return orderedResults;
  }
  getElementTypesFromTaggers() {
    const elementTypes = {};
    const taggerToElementMap = {
      person: 'persName',
      place: 'placeName',
      organization: 'orgName',
      thing: 'name',
      keyword: 'term',
      date: 'date',
      bibliography: 'bibl',
      quote: 'q',
      note: 'note',
      correction: 'corr',
      link: 'ref',
      translation: 'note'
    };
    Object.keys(Taggers).forEach(taggerKey => {
      const elementType = taggerToElementMap[taggerKey] || taggerKey;
      elementTypes[elementType] = true;
    });
    return elementTypes;
  }
  async parseFileForTerms(file, elements, results) {
    return new Promise((resolve, reject) => {
      const parser = sax.parser(true, {
        trim: true,
        normalize: true
      });
      const elementSet = new Set(elements);
      let captureStack = [];
      parser.onopentag = node => {
        if (elementSet.has(node.name)) {
          captureStack.push({
            name: node.name,
            attributes: node.attributes,
            text: ''
          });
        } else if (captureStack.length > 0) {
          const currentElement = captureStack[captureStack.length - 1];
          if (currentElement.text.length > 0 && !currentElement.text.endsWith(' ')) {
            currentElement.text += ' ';
          }
        }
      };
      parser.ontext = text => {
        if (captureStack.length > 0) {
          captureStack[captureStack.length - 1].text += text;
        }
      };
      parser.onclosetag = tagName => {
        if (captureStack.length > 0 && captureStack[captureStack.length - 1].name === tagName) {
          const node = captureStack.pop();
          const termText = node.text.replace(/\s+/g, ' ').trim();
          if (termText) {
            this.processTerm(node.name, termText, node.attributes, file.name, results);
          }
        }
      };
      parser.onerror = error => {
        console.error(`Errore parsing ${file.name}:`, error);
        reject(error);
      };
      parser.onend = () => {
        resolve();
      };
      try {
        parser.write(file.content).close();
      } catch (error) {
        reject(error);
      }
    });
  }
  processTerm(elementType, termText, attributes, fileName, results) {
    const map = results[elementType];
    if (!map) return;
    let id = null;
    if (attributes.ref) {
      id = attributes.ref.replace(/^#/, '');
    } else if (attributes['xml:id'] || attributes.id) {
      id = attributes['xml:id'] || attributes.id;
    } else if (elementType === 'date' && attributes.when) {
      id = `date_${attributes.when}`;
    } else if (elementType === 'bibl' && (attributes['xml:id'] || attributes.n)) {
      id = attributes['xml:id'] || `bibl_${attributes.n}`;
    } else {
      const normalized = termText.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      id = `${elementType}_${normalized}`;
    }
    if (map.has(id)) {
      const entry = map.get(id);
      entry.count++;
      entry.files.add(fileName);
      entry.terms.push(termText);
    } else {
      map.set(id, {
        id: id,
        term: termText,
        terms: [termText],
        count: 1,
        files: new Set([fileName])
      });
    }
  }
  async generateTeiHeader(termLists) {
    this.emitProgress(0, 'Generazione header...');
    const headerParts = [];
    headerParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    headerParts.push('<teiHeader xmlns="http://www.tei-c.org/ns/1.0">');
    headerParts.push('  <fileDesc>');
    headerParts.push('    <titleStmt>');
    headerParts.push('      <title>Lista termini estratti</title>');
    headerParts.push('    </titleStmt>');
    headerParts.push('    <publicationStmt>');
    headerParts.push('      <p>Generato automaticamente</p>');
    headerParts.push('    </publicationStmt>');
    headerParts.push('    <sourceDesc>');
    headerParts.push('      <p>Estratto da corpora XML-TEI</p>');
    headerParts.push('    </sourceDesc>');
    headerParts.push('  </fileDesc>');
    if (Object.keys(termLists).length > 0) {
      headerParts.push('  <profileDesc>');
      if (termLists.persName && termLists.persName.length > 0) {
        headerParts.push('    <particDesc>');
        headerParts.push('      <listPerson>');
        termLists.persName.forEach(item => {
          headerParts.push(`        <person xml:id="${item.id}">`);
          const variants = item.terms && item.terms.length > 0 ? item.terms : [item.term];
          variants.forEach(variant => {
            headerParts.push(`          <persName>${this.escapeXml(variant)}</persName>`);
          });
          headerParts.push('        </person>');
        });
        headerParts.push('      </listPerson>');
        headerParts.push('    </particDesc>');
      }
      if (termLists.placeName && termLists.placeName.length > 0) {
        headerParts.push('    <settingDesc>');
        headerParts.push('      <listPlace>');
        termLists.placeName.forEach(item => {
          headerParts.push(`        <place xml:id="${item.id}">`);
          const variants = item.terms && item.terms.length > 0 ? item.terms : [item.term];
          variants.forEach(variant => {
            headerParts.push(`          <placeName>${this.escapeXml(variant)}</placeName>`);
          });
          headerParts.push('        </place>');
        });
        headerParts.push('      </listPlace>');
        headerParts.push('    </settingDesc>');
      }
      if (termLists.orgName && termLists.orgName.length > 0) {
        headerParts.push('    <particDesc>');
        headerParts.push('      <listOrg>');
        termLists.orgName.forEach(item => {
          headerParts.push(`        <org xml:id="${item.id}">`);
          const variants = item.terms && item.terms.length > 0 ? item.terms : [item.term];
          variants.forEach(variant => {
            headerParts.push(`          <orgName>${this.escapeXml(variant)}</orgName>`);
          });
          headerParts.push('        </org>');
        });
        headerParts.push('      </listOrg>');
        headerParts.push('    </particDesc>');
      }
      if (termLists.date && termLists.date.length > 0) {
        headerParts.push('    <settingDesc>');
        headerParts.push('      <list>');
        termLists.date.forEach(item => {
          const when = item.id.startsWith('date_') ? item.id.substring(5) : item.id;
          headerParts.push(`        <date when="${when}">${this.escapeXml(item.term)}</date>`);
        });
        headerParts.push('      </list>');
        headerParts.push('    </settingDesc>');
      }
      if (termLists.bibl && termLists.bibl.length > 0) {
        headerParts.push('    <listBibl>');
        termLists.bibl.forEach(item => {
          const variants = item.terms && item.terms.length > 0 ? item.terms : [item.term];
          variants.forEach((variant, index) => {
            const idAttr = variants.length > 1 ? `${item.id}_${index + 1}` : item.id;
            headerParts.push(`      <bibl xml:id="${idAttr}">${this.escapeXml(variant)}</bibl>`);
          });
        });
        headerParts.push('    </listBibl>');
      }
      const genericElements = ['term', 'name', 'q', 'ref', 'corr', 'note'];
      genericElements.forEach(elementType => {
        if (termLists[elementType] && termLists[elementType].length > 0) {
          headerParts.push(`    <list type="${elementType}">`);
          termLists[elementType].forEach(item => {
            const variants = item.terms && item.terms.length > 0 ? item.terms : [item.term];
            variants.forEach((variant, index) => {
              const idAttr = variants.length > 1 ? `${item.id}_${index + 1}` : item.id;
              headerParts.push(`      <item xml:id="${idAttr}">${this.escapeXml(variant)}</item>`);
            });
          });
          headerParts.push('    </list>');
        }
      });
      headerParts.push('  </profileDesc>');
    }
    headerParts.push('</teiHeader>');
    this.emitProgress(100, 'Header generato!');
    return headerParts.join('\n');
  }
  escapeXml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}
export default new SaxParserLists();
