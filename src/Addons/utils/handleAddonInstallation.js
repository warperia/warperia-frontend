import axios from "axios";
import { WEB_URL, GITHUB_TOKEN } from "./../../config.js";
import cleanupDownload from "./cleanupDownload.js";
import updateAddonInstallStats from "./updateAddonInstallStats.js";
const GITHUB_ACCESS_TOKEN = `${GITHUB_TOKEN}`;
/**
 * Handles the installation of an addon
 */
const handleAddonInstallation = async (
  addon,
  event,
  isReinstall = false,
  skipBundledCheck = false,
  params = {}
) => {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const {
    setShowDeleteModal,
    setDeleteModalData,
    gameDir,
    semverCompare,
    showToastMessage,
    isPathInsideDirectory,
    hasMultipleSubfolders,
    setDownloading,
    setInstallingAddonId,
    setInstallingAddonStep,
    installedAddons,
    window,
    normalizeTitle,
    parseSerializedPHPArray,
    findChildAddons,
    findParentAddons,
    allAddons,
    setProgress,
    startArtificialProgress,
    stopArtificialProgress,
    artificialProgress,
    fetchGitHubFingerprint,
    setShowModal,
    currentExpansion,
    serverId,
    setInstalledAddons,
    refreshAddonsData,
    queuedAddons,
    skipRefresh = false
  } = params;

  setShowDeleteModal(false);
  setDeleteModalData({ addon: null, parents: [], children: [] });

  if (!gameDir) {
    showToastMessage(
      "Your game directory is not configured for this expansion.",
      "danger"
    );
    return;
  }

  const addonUrl = addon.custom_fields.file;
  if (!addonUrl) {
    showToastMessage(
      "The source URL for this addon couldn't be found.",
      "danger"
    );
    return;
  }

  const absoluteGameDir = window.electron.pathResolve(gameDir);
  const installPath = window.electron.pathJoin(
    absoluteGameDir,
    "Interface",
    "AddOns"
  );
  const addonTitle = normalizeTitle(
    addon.custom_fields.title_toc || addon.title
  );

  // Validate installPath
  if (!isPathInsideDirectory(installPath, absoluteGameDir)) {
    console.error("Invalid installation path:", installPath);
    showToastMessage("Invalid game directory.", "danger");
    return;
  }

  let modalShown = false;

  // Auto-skip bundled check for reinstalls
  if (isReinstall) {
    skipBundledCheck = true;
  }

  let gitFingerprint = null;

  try {
    setDownloading(true);
    setInstallingAddonId(addon.id);
    setInstallingAddonStep("Deleting previous folders");

    // ----------------------------------------------------------------------------------
    // Step 1: Handle Variations
    // ----------------------------------------------------------------------------------
    let mainAddon = addon;
    const isVariation = addon.custom_fields.variation;

    if (isVariation && isVariation !== "0") {
      // Fetch main addon if installing a variation
      const mainAddonResponse = await axios.get(
        `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${isVariation}`
      );
      mainAddon = mainAddonResponse.data;
    }

    // Get variations from the MAIN addon
    const hasVariations = mainAddon.custom_fields?.has_variations || [];
    const relatedAddons = parseSerializedPHPArray(hasVariations);

    // Check if the main addon or any of its variations have bundled addons
    const currentlyInstalledAddon = Object.values(installedAddons).find(
      (installed) => {
        // Check if the installed addon is the main addon or one of its variations
        return (
          installed.id === mainAddon.id || relatedAddons.includes(installed.id)
        );
      }
    );

    // ----------------------------------------------------------------------------------
    // Step 2: Optional Bundled Addons Check
    // ----------------------------------------------------------------------------------
    if (!skipBundledCheck) {
      // Check if main addon/variations have bundled addons
      const allAddonsToCheck = [
        mainAddon,
        ...relatedAddons.map((id) => allAddons.find((a) => a.id === id)),
      ];
      const bundledAddons = allAddonsToCheck.flatMap((parentAddon) => {
        return findChildAddons(parentAddon, installedAddons).filter((child) => {
          // Only consider children that are EXCLUSIVE to this parent
          const childParents = findParentAddons(child, installedAddons);
          return childParents.some((p) => p.id === parentAddon.id);
        });
      });

      const findStandaloneCopies = (mainAddon, installedAddons) => {
        // Get main addon's root parent
        const getRootParent = (addon) => {
          if (
            addon.custom_fields?.variation &&
            addon.custom_fields.variation !== "0"
          ) {
            const parent = allAddons.find(
              (a) => a.id === parseInt(addon.custom_fields.variation)
            );
            return parent ? getRootParent(parent) : addon;
          }
          return addon;
        };

        const mainRoot = getRootParent(mainAddon);

        return [
          ...new Set(
            Object.values(installedAddons).filter((installed) => {
              const installedRoot = getRootParent(installed);
              return (
                installedRoot.id !== mainRoot.id &&
                installed.custom_fields.folder_list.some(([f]) =>
                  mainAddon.custom_fields.folder_list.some(([mf]) => mf === f)
                )
              );
            })
          ),
        ];
      };

      if (bundledAddons.length > 0) {
        setDeleteModalData({
          addon: currentlyInstalledAddon,
          newAddon: mainAddon,
          parents: [],
          children: bundledAddons,
          isInstallation: true,
          standaloneAddons: findStandaloneCopies(mainAddon, installedAddons),
        });
        setShowDeleteModal(true);
        setShowModal(false);
        return;
      }
    }

    // ----------------------------------------------------------------------------------
    // Step 2.5: Delete existing folders from main addon + all variations
    // ----------------------------------------------------------------------------------
    const addonsToDelete = [mainAddon.id, ...relatedAddons];
    await Promise.all(
      addonsToDelete.map(async (relatedAddonId) => {
        const installedAddon = Object.values(installedAddons).find(
          (installed) => installed.id === parseInt(relatedAddonId, 10)
        );

        if (installedAddon) {
          const foldersToDelete = installedAddon.custom_fields.folder_list.map(
            ([folderName]) => folderName
          );

          await Promise.all(
            foldersToDelete.map(async (folder) => {
              const folderPath = window.electron.pathJoin(installPath, folder);

              // Get ALL installed addons using this folder
              const folderUsers = Object.values(installedAddons).filter(
                (inst) =>
                  inst.custom_fields.folder_list.some(([f]) => f === folder)
              );

              const isSameFamily = folderUsers.some((inst) => {
                // Recursive family check
                const getRootParent = (addon) => {
                  if (
                    addon.custom_fields?.variation &&
                    addon.custom_fields.variation !== "0"
                  ) {
                    const parent = allAddons.find(
                      (a) => a.id === parseInt(addon.custom_fields.variation)
                    );
                    return parent ? getRootParent(parent) : addon;
                  }
                  return addon;
                };

                const installedRoot = getRootParent(inst);
                const mainAddonRoot = getRootParent(mainAddon);

                return installedRoot.id === mainAddonRoot.id;
              });

              if (!isSameFamily) {
                return; // Skip deletion
              }

              // Validate folderPath
              if (!isPathInsideDirectory(folderPath, installPath)) {
                console.error(
                  "Attempted path traversal attack detected:",
                  folderPath
                );
                showToastMessage("Invalid folder path.", "danger");
                return;
              }

              // Check if folder is used by other installed addons
              const isFolderUsed = Object.values(installedAddons).some(
                (ia) =>
                  ia.id !== installedAddon.id &&
                  ia.custom_fields.folder_list.some(([f]) => f === folder)
              );
              if (isFolderUsed) {
                return; // Skip deletion
              }

              // Attempt to delete the folder and confirm deletion
              let deleteSuccess = false;
              for (let attempt = 0; attempt < 2; attempt++) {
                await window.electron.deleteFolder(folderPath);
                setInstallingAddonStep(`Deleting old folders`);

                // Check if the folder still exists using fileExists
                if (!(await window.electron.fileExists(folderPath))) {
                  deleteSuccess = true;
                  break;
                } else {
                  console.warn(
                    `Attempt ${
                      attempt + 1
                    } to delete folder ${folderPath} failed. Retrying...`
                  );
                  // Short delay before retry
                  await new Promise((resolve) => setTimeout(resolve, 200));
                }
              }

              if (!deleteSuccess) {
                showToastMessage(
                  `Failed to delete folder: ${folderPath}`,
                  "danger"
                );
              }
            })
          );
        }
      })
    );

    // ----------------------------------------------------------------------------------
    // Step 3: Download and extract the new addon
    // IMPORTANT: responseType is "blob" so .arrayBuffer() works in Electron
    // ----------------------------------------------------------------------------------
    setInstallingAddonStep("Downloading addon...");

    let contentLength = 0;
    let response;
    let fileName;
    let zipFilePath;

    // Check if there's a GitHub link in website_link
    const websiteLink = addon.custom_fields.website_link || "";

    if (websiteLink.includes("github.com")) {
      try {
        // Attempt GitHub download
        const githubRegex = /https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/|$)/;
        const match = websiteLink.match(githubRegex);

        if (!match) {
          throw new Error("Invalid GitHub URL format");
        }

        const owner = match[1];
        const repo = match[2];

        // 1) Fetch repo metadata (for default branch)
        const repoMeta = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: {
              Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
            },
          }
        );
        const defaultBranch = repoMeta.data.default_branch || "main";

        // 2) Download the repository zip from default branch
        const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`;
        try {
          const headRes = await axios.head(zipUrl, {
            headers: {
              Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
              Accept: "application/vnd.github.v3.raw",
            },
          });
          if (headRes.headers["content-length"]) {
            contentLength = parseInt(headRes.headers["content-length"], 10);
          } else {
            startArtificialProgress();
          }
        } catch (headError) {
          console.warn(
            "[Warperia] HEAD request failed. Falling back to unknown size."
          );
        }

        // 3) Download the repository zip from default branch
        response = await axios.get(zipUrl, {
          responseType: "blob",
          maxContentLength: Infinity, // prevent large-file truncation
          maxBodyLength: Infinity,
          headers: {
            Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
            Accept: "application/vnd.github.v3.raw",
          },
          onDownloadProgress: (progressEvent) => {
            let total = contentLength || progressEvent.total;

            if (total && total > 0) {
              // We know the file size => normal real progress
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / total
              );
              // Stop artificial increments & reflect real progress
              stopArtificialProgress(percentCompleted);
              setProgress(percentCompleted);
            } else {
              // We do NOT know the file size => use artificial progress
              setProgress(artificialProgress);
            }
          },
        });

        // Once download completes, jump to 100%
        stopArtificialProgress(100);
        setProgress(100);

        // We'll name the downloaded file after the addon title
        fileName = `${addonTitle.replace(/\s+/g, "_")}.zip`;

        // Save the file using Electron bridge
        zipFilePath = await window.electron.saveZipFile(
          response.data,
          fileName
        );

        // 3) Attempt to fetch the current GitHub fingerprint (release tag or commit SHA)
        try {
          const githubRegex =
            /https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/|$)/;
          const matchGit = websiteLink.match(githubRegex);
          if (matchGit) {
            const owner = matchGit[1];
            const repo = matchGit[2];
            const { type, value } = await fetchGitHubFingerprint(
              owner,
              repo,
              GITHUB_ACCESS_TOKEN
            );
            gitFingerprint = value;
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch GitHub fingerprint:", fetchErr);
          // Not fatal; we just won't store anything
        }
      } catch (githubError) {
        console.warn(
          "GitHub download failed. Falling back to original WordPress download:",
          githubError
        );

        // Fallback to WordPress zip
        response = await axios.get(addonUrl, {
          responseType: "blob",
          onDownloadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          },
        });
        fileName = addonUrl.split("/").pop();
        zipFilePath = await window.electron.saveZipFile(
          response.data,
          fileName
        );
      }
    } else {
      // Original WordPress download
      response = await axios.get(addonUrl, {
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        },
      });
      fileName = addonUrl.split("/").pop();
      zipFilePath = await window.electron.saveZipFile(response.data, fileName);
    }

    // Record what's in AddOns before extraction
    const beforeInstallItems = await window.electron.readDir(installPath);

    // Extract into the AddOns folder
    await window.electron.extractZip(zipFilePath, installPath);

    // ----------------------------------------------------------------------------------
    // Step 3.5: Rename the newly extracted folder to match the main folder name
    // IF (and only if) there's exactly one new top-level directory.
    // ----------------------------------------------------------------------------------
    setInstallingAddonStep("Restructuring folder...");
    const mainFolder = addon.custom_fields.folder_list.find(
      ([_, isMain]) => isMain === "1"
    );
    if (!mainFolder) {
      console.error("Main folder not found in addon data:", addonTitle);
      showToastMessage(`Main folder not found for "${addonTitle}"`, "danger");
      throw new Error("Missing mainFolder in custom_fields.folder_list");
    }
    const [mainFolderName] = mainFolder;

    // 2) Compare "before" vs. "after" to see only new folders
    const afterInstallItems = await window.electron.readDir(installPath);
    const newlyExtractedFolders = afterInstallItems.filter(
      (item) => !beforeInstallItems.includes(item)
    );

    // 2) If there's exactly one new parent folder, flatten it so that
    // all subfolders  end up in AddOns.
    if (newlyExtractedFolders.length === 1) {
      const extractedFolderName = newlyExtractedFolders[0];
      const extractedFolderPath = window.electron.pathJoin(
        installPath,
        extractedFolderName
      );

      // 1) Check if this single folder contains multiple subfolders from the addon folder_list
      const isMultiFolder = await hasMultipleSubfolders(
        extractedFolderPath,
        addon.custom_fields.folder_list
      );

      if (isMultiFolder) {
        // MULTI-FOLDER scenario
        // Flatten them all directly into AddOns
        await flattenSingleExtractedFolder(extractedFolderPath, installPath);
      } else {
        // SIMPLE SINGLE-FOLDER scenario => do the old rename approach
        let finalFolderPath = extractedFolderPath;
        if (extractedFolderName !== mainFolderName) {
          const oldPath = extractedFolderPath;
          const newPath = window.electron.pathJoin(installPath, mainFolderName);

          await copyFolderRecursively(oldPath, newPath);
          await window.electron.deleteFolder(oldPath);

          // Now the actual folder is called "mainFolderName"
          finalFolderPath = newPath;

          try {
            // 1) Read subfolders from the finalFolderPath
            const { directories: subfolders } =
              await window.electron.readDirAndFiles(finalFolderPath);

            // 2) If there's exactly one subfolder with the *same* name, flatten again:
            if (subfolders.length === 1 && subfolders[0] === mainFolderName) {
              console.log(
                `[Warperia] Found a double folder: ${mainFolderName}\\${mainFolderName}. Flattening...`
              );

              const innerPath = window.electron.pathJoin(
                finalFolderPath,
                mainFolderName
              );
              await flattenSingleExtractedFolder(innerPath, finalFolderPath);
            }
          } catch (err) {
            console.warn("Double‐folder check failed:", err);
          }
        }
      }

      try {
        // Check if the extracted folder exactly matches your mainFolderName
        if (extractedFolderName === mainFolderName) {
          // Read the subfolders INSIDE that newly renamed folder
          const { directories: subfolders } =
            await window.electron.readDirAndFiles(extractedFolderPath);

          // If there's exactly one subfolder with the same name, flatten again
          if (subfolders.length === 1 && subfolders[0] === mainFolderName) {
            console.log(
              `[Warperia] Detected a double folder: ${mainFolderName}/${mainFolderName}. Flattening...`
            );

            // Example approach: flatten the "inner" Auctionator into the "outer"
            const innerPath = window.electron.pathJoin(
              extractedFolderPath,
              mainFolderName
            );
            await flattenSingleExtractedFolder(innerPath, extractedFolderPath);
          }
        }
      } catch (err) {
        console.warn("Error checking for double-nested folder:", err);
      }
    }

    // ----------------------------------------------------------------------------------
    // Clean up top-level GitHub files
    // ----------------------------------------------------------------------------------
    setInstallingAddonStep("Cleaning up...");
    const topLevelExtras = [
      "README.md",
      "readme.md",
      "README.MD",
      "LICENSE",
      "LICENSE.md",
      ".gitignore",
      ".gitattributes",
      ".github",
    ];
    for (const extra of topLevelExtras) {
      const extraPath = window.electron.pathJoin(installPath, extra);
      if (await window.electron.fileExists(extraPath)) {
        await window.electron.deleteFolder(extraPath);
      }
    }

    // ----------------------------------------------------------------------------------
    // Step 4: Write the .warperia file + update .toc version
    // ----------------------------------------------------------------------------------
    const mainFolderPath = window.electron.pathJoin(
      installPath,
      mainFolderName
    );
    const tocFilePath = window.electron.pathJoin(
      mainFolderPath,
      `${mainFolderName}.toc`
    );

    // Ensure extraction/renaming is complete before writing the new file
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (await window.electron.fileExists(tocFilePath)) {
      const versionFromToc =
        (await window.electron.readVersionFromToc(tocFilePath)) || "1.0.0";

      // Double-check that no old data is left before writing the new file
      const warperiaFilePath = window.electron.pathJoin(
        mainFolderPath,
        `${mainFolderName}.warperia`
      );

      const wordPressVersionAtTimeOfInstall =
        addon.custom_fields.version || "1.0.0";
      const backendFilename = addon.custom_fields.file.split("/").pop();

      await window.electron.deleteFolder(warperiaFilePath); // Delete old .warperia if exists
      const warperiaContent = `ID: ${
        addon.id
      }\nFolders: ${addon.custom_fields.folder_list
        .map(([folderName]) => folderName)
        .join(
          ","
        )}\nBackendVersion: ${wordPressVersionAtTimeOfInstall}\nFilename: ${backendFilename}\n${
        gitFingerprint ? `GitFingerprint: ${gitFingerprint}` : ""
      }`;

      await window.electron.writeFile(warperiaFilePath, warperiaContent);

      // Immediately read back the file to confirm content
      const writtenContent = await window.electron.readFile(warperiaFilePath);
      if (writtenContent !== warperiaContent) {
        console.error(
          "Mismatch in written .warperia file! Expected:",
          warperiaContent,
          "but got:",
          writtenContent
        );
      }

      // Compare versionFromToc vs. wordPressVersionAtTimeOfInstall
      let finalTocVersion = versionFromToc;
      const compareResult = semverCompare(
        versionFromToc,
        wordPressVersionAtTimeOfInstall
      );
      if (compareResult < 0) {
        finalTocVersion = wordPressVersionAtTimeOfInstall;
      }
      await window.electron.updateTocVersion(mainFolderPath, finalTocVersion);
    } else {
      // If the .toc wasn't found in the newly renamed folder:
      console.warn(
        `No .toc file found in main folder "${mainFolderName}", defaulting to version 1.0.0.`
      );
    }

    // ----------------------------------------------------------------------------------
    // Step 5: Cleanup and finalize installation
    // ----------------------------------------------------------------------------------
    await cleanupDownload(zipFilePath);
    await updateAddonInstallStats(addon.id, addon.type);
    if ((!queuedAddons || queuedAddons.length === 0) && !skipRefresh) {
      await refreshAddonsData();
    }
    if ((!queuedAddons || queuedAddons.length === 0) && !skipRefresh) {
    showToastMessage(
      `Your addon was ${isReinstall ? "reinstalled" : "installed"}!`,
      "success"
    );
  }
  } catch (error) {
    console.error("Error installing addon:", error);
    showToastMessage(
      `The addon couldn't be installed: ${error.message}`,
      "danger"
    );
  } finally {
    setDownloading(false);
    setInstallingAddonId(null);
    setInstallingAddonStep(null);
    setProgress(0);
    stopArtificialProgress(0);
  }
};

export default handleAddonInstallation;