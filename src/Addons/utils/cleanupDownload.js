const cleanupDownload = async (zipPath) => {
  if (!zipPath) return;
  
  try {
    const exists = await window.electron.fileExists(zipPath);
    if (exists) {
      await window.electron.deleteFile(zipPath);
    }
  } catch (error) {
    console.error('Error cleaning up downloaded file:', error);
  }
};

export default cleanupDownload; 