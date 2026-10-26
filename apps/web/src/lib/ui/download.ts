// Hands a file to the user, as the browser's download.

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // The download has started from the URL; give it a moment before letting it go.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}
