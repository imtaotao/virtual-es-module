type ExecCode = () => void;
export function startByUrl(entry: string): Promise<ExecCode>;
export function startByCode(originCode: string, filename: string, metaUrl?: string): Promise<ExecCode>; 
export function startByScriptTags(typeFlag: string): Promise<void>;