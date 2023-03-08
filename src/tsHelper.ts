import * as path from 'path'
import * as fs from 'fs'
import * as ts from 'typescript'

/**
 * Given a file, return the list of files it imports as absolute paths.
 * 
 * @param file The file to analyze for imports (relative to srcRoot)
 * @param srcRoot The path to the root of the source code
 */
export function getImportsForFile(file: string, srcRoot: string) {
  // Follow symlink so directory check works.
  let realfile = fs.realpathSync(path.join(srcRoot, file))

  if (fs.lstatSync(realfile).isDirectory()) {
    const index = path.join(file, "index.ts")
    if (fs.existsSync(index)) {
      // https://basarat.gitbooks.io/typescript/docs/tips/barrel.html
      console.warn(`Warning: Barrel import: ${file}`)
      realfile = index
    } else {
      throw new Error(`Warning: Importing a directory without an index.ts file: ${file}`)
    }
  }

  const fileInfo = ts.preProcessFile(fs.readFileSync(realfile).toString());
  return fileInfo.importedFiles
    .map(importedFile => importedFile.fileName)
    // remove svg, css imports
    .filter(fileName => !fileName.endsWith(".css") && !fileName.endsWith(".svg") && !fileName.endsWith(".json"))
    .filter(fileName => !fileName.endsWith(".js") && !fileName.endsWith(".jsx")) // Assume .js/.jsx imports have a .d.ts available
    .filter(x => /\//.test(x)) // remove node modules (the import must contain '/')
    .map(fileName => {
      if (/(^\.\/)|(^\.\.\/)/.test(fileName)) {
        return path.join(path.dirname(realfile), fileName)
      }
      return path.join(srcRoot, fileName);
    }).map(fileName => {
      if (fs.existsSync(`${fileName}.ts`)) {
        return `${fileName}.ts`
      }
      if (fs.existsSync(`${fileName}.tsx`)) {
        return `${fileName}.tsx`
      }
      if (fs.existsSync(`${fileName}.d.ts`)) {
        return `${fileName}.d.ts`
      }
      if (fs.existsSync(`${fileName}`)) {
        return fileName
      }
      console.warn(`Warning: Unresolved import ${path.relative(srcRoot, fileName)} ` +
                   `in ${file}`)
      return null
    }).filter(fileName => !!fileName)
}

/**
 * This class memoizes the list of imports for each file.
 */
export class ImportTracker {
  private imports = new Map<string, string[]>()

  constructor(private srcRoot: string) {}

  public getImports(file: string): string[] {
    if (this.imports.has(file)) {
      return this.imports.get(file)
    }
    const imports = getImportsForFile(file, this.srcRoot)
    this.imports.set(file, imports)
    return imports
  }
}
