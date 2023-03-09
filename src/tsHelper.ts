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
  let absoluteFile = fs.realpathSync(path.join(srcRoot, file))

  if (fs.lstatSync(absoluteFile).isDirectory()) {
    const index = path.join(file, "index.ts")
    if (fs.existsSync(index)) {
      // https://basarat.gitbooks.io/typescript/docs/tips/barrel.html
      console.warn(`Warning: Barrel import: ${file}`)
      absoluteFile = index
    } else {
      throw new Error(`Warning: Importing a directory without an index.ts file: ${file}`)
    }
  }

  const fileInfo = ts.preProcessFile(fs.readFileSync(absoluteFile).toString());
  return fileInfo.importedFiles
    .map(importedFile => importedFile.fileName)
    // remove svg, css imports
    .filter(fileName => !fileName.endsWith(".css") && !fileName.endsWith(".svg") && !fileName.endsWith(".json"))
    .filter(fileName => !fileName.endsWith(".js") && !fileName.endsWith(".jsx")) // Assume .js/.jsx imports have a .d.ts available
    .filter(x => /\//.test(x)) // remove node modules (the import must contain '/')
    .map(moduleName => {
      const resolvedFile = resolveFile(absoluteFile, moduleName, srcRoot);
      if (!resolvedFile) 
        console.warn(`Warning: Unresolved import ${path.relative(srcRoot, moduleName)} in ${file}`)
      return resolvedFile;
    }).filter(fileName => !!fileName)
}

function getPath(sourceFile: string, moduleName: string, srcRoot: string): string {
  if (/(^\.\/)|(^\.\.\/)/.test(moduleName)) {
    return path.join(path.dirname(sourceFile), moduleName)
  }
  return path.join(srcRoot, moduleName)
}

function resolveFile(sourceFile: string, moduleName: string, srcRoot: string): string | null {
  const path = getPath(sourceFile, moduleName, srcRoot)
  const suffixes = [".ts", ".tsx", ".d.ts", ""]
  for (const suffix of suffixes) {
    if (fs.existsSync(`${path}${suffix}`)) {
      return `${path}${suffix}`
    }
  }
  return null
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
