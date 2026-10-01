const fs = require('fs');

function injectDownloadHandler(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');

  if (!c.includes('handleDownloadSnapshot')) {
    const handler = `
  const handleDownloadSnapshot = async (e: React.MouseEvent, url: string, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed', error);
      window.open(url, '_blank');
    }
  };
`;
    // Insert before return (
    const returnIndex = c.lastIndexOf('  return (');
    if (returnIndex > -1) {
      c = c.slice(0, returnIndex) + handler + c.slice(returnIndex);
    }
  }

  // Replace <a download ... > with button onClick={...}
  // OperationsArchive Lightbox
  c = c.replace(
    /<a\n[\s\S]*?href=\{snapshotPreviewModal\}\n[\s\S]*?download="lagekarte-snapshot\.jpg"\n[\s\S]*?onClick=\{\(e\) => e\.stopPropagation\(\)\}\n([\s\S]*?)>([\s\S]*?)<\/a>/g,
    `<button\n              type="button"\n              onClick={(e) => handleDownloadSnapshot(e, snapshotPreviewModal, "lagekarte-snapshot.jpg")}\n$1>$2</button>`
  );

  // MissionLog Snapshot Modal
  c = c.replace(
    /<a\n[\s\S]*?href=\{selectedSnapshot\}\n[\s\S]*?download=\{`lagekarte-snapshot-\$\{currentOperation\.id\}\.jpg`\}\n([\s\S]*?)>([\s\S]*?)<\/a>/g,
    `<button\n                  type="button"\n                  onClick={(e) => handleDownloadSnapshot(e, selectedSnapshot, \`lagekarte-snapshot-\${currentOperation.id}.jpg\`)}\n$1>$2</button>`
  );

  // OperationsArchive Inline Log Snapshots (inside the archive list)
  // <a href={log.snapshotUrl} download={`lagekarte-${selectedOp.id}-step-${sIdx + 1}.jpg`} ...
  c = c.replace(
    /<a\n[\s\S]*?href=\{log\.snapshotUrl\}\n[\s\S]*?download=\{`lagekarte-\$\{selectedOp\.id\}-step-\$\{sIdx \+ 1\}\.jpg`\}\n([\s\S]*?)>([\s\S]*?)<\/a>/g,
    `<button\n                                  type="button"\n                                  onClick={(e) => handleDownloadSnapshot(e, log.snapshotUrl as string, \`lagekarte-\${selectedOp.id}-step-\${sIdx + 1}.jpg\`)}\n$1>$2</button>`
  );

  // General mapSnapshotUrl download
  c = c.replace(
    /<a\n[\s\S]*?href=\{selectedOp\.mapSnapshotUrl\}\n[\s\S]*?download=\{`lagekarte-\$\{selectedOp\.id\}\.jpg`\}\n([\s\S]*?)>([\s\S]*?)<\/a>/g,
    `<button\n                              type="button"\n                              onClick={(e) => handleDownloadSnapshot(e, selectedOp.mapSnapshotUrl as string, \`lagekarte-\${selectedOp.id}.jpg\`)}\n$1>$2</button>`
  );

  fs.writeFileSync(filePath, c);
}

injectDownloadHandler('src/components/OperationsArchive.tsx');
injectDownloadHandler('src/components/MissionLog.tsx');
console.log('Download handlers injected');
