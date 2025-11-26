/**
 * Options for formatting errors
 */
export interface FormatOptions {
  /**
   * Output format
   * @default 'terminal'
   */
  format?: 'terminal' | 'json' | 'html'
  /**
   * Whether to use colors in terminal output
   * @default true
   */
  colors?: boolean
  /**
   * JSON indentation spaces
   * @default 2
   */
  indent?: number
}

/**
 * Formats an error for various output targets
 * @param error - The error to format
 * @param options - Formatting options
 * @returns Formatted error string
 */
export function format(error: Error, options?: FormatOptions): string
