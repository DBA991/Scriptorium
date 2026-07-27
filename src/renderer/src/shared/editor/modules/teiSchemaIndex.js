import { parseXsdSchema } from './xsdParser'

import teiAllXsd from '../../../assets/tei_all.xsd?raw'
import teiAllTeixXsd from '../../../assets/tei_all_teix.xsd?raw'

const teiAllSchema = parseXsdSchema(teiAllXsd)
const teiAllTeixSchema = parseXsdSchema(teiAllTeixXsd)
export const availableSchemas = [
  { name: 'TEI All', schema: teiAllSchema },
  { name: 'TEI All TEIx', schema: teiAllTeixSchema }
]
