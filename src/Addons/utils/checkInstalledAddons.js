import axios from "axios";
import { WEB_URL } from "./../../config.js";
import fetchAddons from "./fetchAddons.js";

/**
 * Checks for installed addons in the specified game path
 */
const checkInstalledAddons = async (gamePath, params = {}) => {
  const {
    setScanningAddons,
    isPathInsideDirectory,
    showToastMessage,
    window,
    allAddons,
    setAllAddons,
    parseGitFingerprint,
    checkIfGitHubOutdated,
    currentExpansion,
    setModalQueue,
    setShowAddonSelectionModal,
    setCurrentModalData,
    setInstalledAddons
  } = params;

  try {
    setScanningAddons(true);

    // 1) Normalize the path to Interface/AddOns
    const absoluteGameDir = window.electron.pathResolve(gamePath);
    const addonsDir = window.electron.pathJoin(
      absoluteGameDir,
      "Interface",
      "AddOns"
    );

    // 2) Validate that the addonsDir is inside the gameDir
    if (!isPathInsideDirectory(addonsDir, absoluteGameDir)) {
      console.error("Invalid game directory:", addonsDir);
      showToastMessage("Invalid game directory.", "danger");
      return;
    }

    // 3) Get all top-level folders in the AddOns directory
    const addonFolders = await window.electron.readDir(addonsDir);

    // 4) Make sure we have the full list of allAddons; if not, fetch them in batches
    let fetchedAddons = allAddons;
    if (!fetchedAddons || fetchedAddons.length === 0) {
      let currentPage = 1;
      const pageSize = 100;
      let totalPages = 1;

      do {
        const { data: batchAddons, totalPages: fetchedTotalPages } =
          await fetchAddons(
            `${currentExpansion}`, // Post type or expansion
            currentPage,
            "",
            [],
            pageSize
          );
        fetchedAddons = [...fetchedAddons, ...batchAddons];
        totalPages = fetchedTotalPages || 1;
        currentPage++;
      } while (currentPage <= totalPages);

      setAllAddons(fetchedAddons);
    }

    if (fetchedAddons.length === 0) {
      let currentPage = 1;
      const pageSize = 100;
      let totalPages = 1;
      do {
        const { data: batchAddons, totalPages: fetchedTotalPages } =
          await fetchAddons(
            `${currentExpansion}`,
            currentPage,
            "",
            [],
            pageSize
          );
        fetchedAddons = [...fetchedAddons, ...batchAddons];
        totalPages = fetchedTotalPages || 1;
        currentPage++;
      } while (currentPage <= totalPages);
      setAllAddons(fetchedAddons);
    }

    /*
     * 5) Create a mapping from MAIN folders to addons ONLY.
     * This prevents subfolders from incorrectly matching another addon
     */
    const folderNameToAddons = {};
    fetchedAddons.forEach((addon) => {
      if (addon.custom_fields && addon.custom_fields.folder_list) {
        addon.custom_fields.folder_list.forEach(([folderName, isMain]) => {
          if (isMain === "1") {
            if (!folderNameToAddons[folderName]) {
              folderNameToAddons[folderName] = [];
            }
            folderNameToAddons[folderName].push(addon);
          }
        });
      }
    });

    /*
     * We'll store discovered addons in matchedAddons,
     * plus any conflicts in modalQueueTemp for AddonSelectionModal.
     */
    const matchedAddons = {};
    let modalQueueTemp = [];

    // 6) Iterate over each folder in the user's AddOns directory
    await Promise.all(
      addonFolders.map(async (folder) => {
        const folderPath = window.electron.pathJoin(addonsDir, folder);

        // Skip if no addon claims this folder as its main folder
        const matchingAddons = folderNameToAddons[folder] || [];
        if (matchingAddons.length === 0) {
          return;
        }

        // Read version from .toc if it exists
        const tocFile = window.electron.pathJoin(folderPath, `${folder}.toc`);
        let tocVersion = "1.0.0";
        if (await window.electron.fileExists(tocFile)) {
          const versionFromToc = await window.electron.readVersionFromToc(
            tocFile
          );
          tocVersion = versionFromToc || tocVersion;
        }

        // Check for .warperia file to see if we can identify which exact addon ID was installed
        const warperiaFile = window.electron.pathJoin(
          folderPath,
          `${folder}.warperia`
        );
        const warperiaExists = await window.electron.fileExists(warperiaFile);

        // Create the .warperia file if it doesn't exist
        if (!warperiaExists && matchingAddons.length === 1) {
          const matchedAddon = matchingAddons[0];
          try {
            const warperiaContent = `ID: ${
              matchedAddon.id
            }\nFolders: ${matchedAddon.custom_fields.folder_list
              .map(([f]) => f)
              .join(",")}\nFilename: ${matchedAddon.custom_fields.file
              .split("/")
              .pop()}`;

            await window.electron.writeFile(warperiaFile, warperiaContent);
          } catch (error) {
            console.error(
              `Failed to create .warperia file for ${folder}:`,
              error
            );
          }
        }

        let storedFilename = "";
        let localGitFingerprint = null;
        let localWordPressVersion = "";

        if (await window.electron.fileExists(warperiaFile)) {
          const warperiaContent = await window.electron.readFile(warperiaFile);
          const installedAddonId = warperiaContent.match(/ID:\s*(\d+)/)?.[1];
          const filenameMatch = warperiaContent.match(/Filename:\s*(.+)/);
          const localWpVersionMatch = warperiaContent.match(
            /^WordPressVersion:\s*(.+)$/m
          );
          let localWordPressVersion = "";
          if (localWpVersionMatch) {
            localWordPressVersion = localWpVersionMatch[1].trim();
          }
          const localGitFingerprint = parseGitFingerprint(warperiaContent);
          if (filenameMatch) {
            storedFilename = filenameMatch[1];
          }

          if (!filenameMatch) {
            const matchedAddon = fetchedAddons.find(
              (a) => a.id === parseInt(installedAddonId, 10)
            );
            if (matchedAddon) {
              const addonUrl = matchedAddon.custom_fields.file;
              const newFilename = addonUrl.split("/").pop();
              const newWarperiaContent = `${warperiaContent}\nFilename: ${newFilename}`;

              await window.electron.overwriteFile(
                warperiaFile,
                newWarperiaContent
              );
              storedFilename = newFilename;
            }
          } else {
            storedFilename = filenameMatch[1];
          }

          if (installedAddonId) {
            const matchedAddon = fetchedAddons.find(
              (a) => a.id === parseInt(installedAddonId, 10)
            );
            if (matchedAddon) {
              // Check if any subfolders are missing (corruption check)
              const allAddonFolders =
                matchedAddon.custom_fields.folder_list.map(([f]) => f);
              const missingFolders = allAddonFolders.filter(
                (sub) => !addonFolders.includes(sub)
              );

              matchedAddons[folder] = {
                ...matchedAddon,
                corrupted: missingFolders.length > 0,
                missingFolders,
                localVersion: tocVersion,
                storedFilename,
                localGitFingerprint,
                localWordPressVersion,
              };
              return; // Done with this folder
            }
          }
        }

        // If there's exactly one matching addon, no conflict
        if (matchingAddons.length === 1) {
          const matchedAddon = matchingAddons[0];
          const allAddonFolders = matchedAddon.custom_fields.folder_list.map(
            ([f]) => f
          );
          const missingFolders = allAddonFolders.filter(
            (sub) => !addonFolders.includes(sub)
          );

          matchedAddons[folder] = {
            ...matchedAddon,
            corrupted: missingFolders.length > 0,
            missingFolders,
            localVersion: tocVersion,
            storedFilename,
            localGitFingerprint,
            localWordPressVersion,
          };
          return;
        }

        // Otherwise, multiple main folder claims
        modalQueueTemp.push(matchingAddons);
      })
    );

    // 7) If conflicts were found, open the addon selection modal
    if (modalQueueTemp.length > 0) {
      setModalQueue(modalQueueTemp);
      setCurrentModalData(modalQueueTemp[0]);
      setShowAddonSelectionModal(true);
    }

    // 7.5) For each installed addon, if it has a GitHub link & local fingerprint, check if there's a new commit/release
    // This makes Warperia "see" a new commit on refresh
    for (const folderName of Object.keys(matchedAddons)) {
      const installedAddon = matchedAddons[folderName];
      const isOutdatedOnGitHub = await checkIfGitHubOutdated(installedAddon);
      if (isOutdatedOnGitHub) {
        installedAddon.corrupted = true;
      }
      matchedAddons[folderName] = installedAddon;
    }

    // 8) Update our state for all installed addons we confidently matched
    setInstalledAddons({ ...matchedAddons });
  } catch (error) {
    console.error("Error checking installed addons:", error);
  } finally {
    setScanningAddons(false);
  }
};

export default checkInstalledAddons;
