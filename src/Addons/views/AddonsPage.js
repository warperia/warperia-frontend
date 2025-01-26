import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    lazy,
    Suspense,
} from "react";
import axios from "axios";
import ContextMenu from "../components/ContextMenu.js";
import fetchAddons from "./../utils/fetchAddons.js";
import Pagination from "./../components/Pagination.js";
import Select from "react-select";
import Tippy from "@tippyjs/react";
import ToastNotifications from "./../components/ToastNotifications.js";
import updateAddonInstallStats from "../utils/updateAddonInstallStats.js";
import updateAddonUninstallStats from "../utils/updateAddonUninstallStats.js";
import useDebouncedSearch from "./../utils/useDebouncedSearch.js";
import { WEB_URL } from "./../../config.js";

// Stylesheets
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "tippy.js/dist/tippy.css";

// Addon Modals
const SwitchVariationModal = lazy(() =>
    import("../components/Modals/SwitchVariationModal.js")
);
const AddonSelectionModal = lazy(() =>
    import("../components/Modals/AddonSelectionModal.js")
);
const ReportModal = lazy(() => import("../components/Modals/ReportModal.js"));
const ExportModal = lazy(() => import("../components/Modals/ExportModal.js"));
const ImportModal = lazy(() => import("../components/Modals/ImportModal.js"));
import DeleteConfirmationModal from "../components/Modals/DeleteConfirmationModal.js";
const AddonModal = lazy(() => import("../components/Modals/AddonModal.js"));

// Addon Cards
import InstalledAddonCard from "./../components/Cards/InstalledAddonCard.js";
import BrowseAddonCard from "./../components/Cards/BrowseAddonCard.js";

const AddonsPage = ({
    user,
    currentExpansion,
    serverPath,
    gamePath,
    activeTab,
    setActiveTab,
    serverId
}) => {
    const [allAddons, setAllAddons] = useState([]);
    const [expandedAddons, setExpandedAddons] = useState([]);
    const [addons, setAddons] = useState([]);
    const [authors, setAuthors] = useState({});
    const [gameDir, setGameDir] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [scanningAddons, setScanningAddons] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [installingAddonId, setInstallingAddonId] = useState(null);
    const [installedAddons, setInstalledAddons] = useState({});
    const [corruptedAddons, setCorruptedAddons] = useState({});
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        xPos: 0,
        yPos: 0,
        addon: null,
    });
    const [showModal, setShowModal] = useState(false);
    const [addonLoading, setAddonLoading] = useState(false);
    const [selectedAddon, setSelectedAddon] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedSorting, setSelectedSorting] = useState({
        value: "installs",
        label: "Most Popular",
    });
    const [previousPage, setPreviousPage] = useState(1);
    const [previousSorting, setPreviousSorting] = useState({
        value: "installs",
        label: "Most Popular",
    });
    const [userId, setUserId] = useState(null);
    const [settings, setSettings] = useState(null); // Backend Settings

    // Sticky Headers
    const mainHeaderRef = useRef(null);
    const containerRef = useRef(null);

    // Addon Selection
    const [showAddonSelectionModal, setShowAddonSelectionModal] = useState(false);
    const [modalQueue, setModalQueue] = useState([]);
    const [currentModalData, setCurrentModalData] = useState(null);

    // Addon Variations Switching
    const [showSwitchModal, setShowSwitchModal] = useState(false);
    const [loadingVariations, setLoadingVariations] = useState(false);
    const [availableVariations, setAvailableVariations] = useState([]);
    const [currentAddon, setCurrentAddon] = useState(null);

    // Addon Reporting
    const [showReportModal, setShowReportModal] = useState(false);
    const [currentAddonForReport, setCurrentAddonForReport] = useState(null);

    // Addon Export and Import
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Addon Delete Confirmation For Bundles
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteModalData, setDeleteModalData] = useState({
        addon: null,
        parents: [],
        children: []
    });

    // Toast notifications state
    const [toasts, setToasts] = useState([]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 20;

    // Search state
    const [searchQuery, setSearchQuery] = useState("");

    // Search state for installed addons
    const [installedSearchQuery, setInstalledSearchQuery] = useState('');

    // Sorting Options
    const sortingOptions = [
        { value: "installs", label: "Most Popular" },
        { value: "recently_added", label: "Recently Added" },
        { value: "recently_updated", label: "Recently Updated" },
    ];

    // Addon Installation Progress
    const [installingAddonStep, setInstallingAddonStep] = useState(null);
    const [progress, setProgress] = useState(0);

    // Toggle the accordion open/close for a given addon ID.
    function toggleAddonExpansion(addonId) {
        setExpandedAddons((prev) => {
            if (prev.includes(addonId)) {
                return prev.filter((id) => id !== addonId);
            } else {
                return [...prev, addonId];
            }
        });
    }

    // Utility function to check if a path is inside a directory
    const isPathInsideDirectory = (childPath, parentPath) => {
        const normalizedChild = window.electron.pathNormalize(childPath);
        const normalizedParent = window.electron.pathNormalize(parentPath);

        // Check if the child path is inside the parent or equal to the parent
        const relative = window.electron.pathRelative(
            normalizedParent,
            normalizedChild
        );
        return (
            relative === "" ||
            (!relative.startsWith("..") && !window.electron.pathIsAbsolute(relative))
        );
    };

    useEffect(() => {
        if (user && user.id) {
            setUserId(user.id);
        }
    }, [user]);

    const retry = async (fn, retries = 3, delay = 1000) => {
        try {
            return await fn();
        } catch (err) {
            if (retries > 1) {
                console.warn(`Retrying... (${retries - 1} attempts left)`);
                await new Promise((res) => setTimeout(res, delay));
                return retry(fn, retries - 1, delay);
            } else {
                throw err;
            }
        }
    };

    useEffect(() => {
        // Fetch the WordPress settings
        const fetchSettings = async () => {
            try {
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/site-settings`
                );
                setSettings(response.data);
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };

        fetchSettings();
    }, []);

    useEffect(() => {
        const initializeGameDirectory = async () => {
            if (!user || !gamePath || !currentExpansion) {
                console.error("User, server path, or expansion not found.");
                return;
            }

            try {
                // Normalize and resolve the game path
                const sanitizedGamePath = window.electron.pathNormalize(
                    window.electron.pathResolve(gamePath)
                );

                // Remove the executable from the path if present
                const sanitizedPath = sanitizedGamePath.replace(
                    /\\[^\\]+\.exe(\.exe)?$/i,
                    ""
                );

                // Validate the game directory path
                if (!isPathInsideDirectory(sanitizedPath, sanitizedGamePath)) {
                    console.error("Invalid game directory:", sanitizedPath);
                    showToastMessage("Invalid game directory.", "danger");
                    return;
                }

                setGameDir(sanitizedPath);
                await checkInstalledAddons(sanitizedPath);
            } catch (error) {
                console.error("Failed to initialize game directory:", error);
            } finally {
                setInitialLoading(false);
            }
        };

        initializeGameDirectory();
    }, [user, gamePath, currentExpansion]);

    useEffect(() => {
        const fetchAllAddons = async () => {
            try {
                let fetchedAddons = [];
                let currentPage = 1;
                const pageSize = 100;
                let totalPages = 1;

                // Fetch all addons from the backend in batches
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
            } catch (error) {
                console.error("Error fetching all addons:", error);
            }
        };

        fetchAllAddons();
    }, []);

    // Refresh the user's installed addons
    const refreshAddonsData = async () => {
        setAllAddons([]);
        await checkInstalledAddons(gameDir);
    };

    const fetchAddonsData = useCallback(
        async (
            page = 1,
            search = "",
            categories = [],
            orderby = selectedSorting.value
        ) => {
            try {
                setLoading(true);
                const { data, totalPages } = await fetchAddons(
                    `${currentExpansion}`,
                    page,
                    search,
                    categories,
                    pageSize,
                    orderby,
                    "desc"
                );

                setAddons(data);
                setTotalPages(totalPages || 1);
                setCurrentPage(page);
            } catch (error) {
                console.error("Error fetching addons:", error);
                setAddons([]);
                setTotalPages(1);
            } finally {
                setLoading(false);
            }
        },
        [selectedSorting.value, selectedCategories, searchQuery]
    );

    // Load the author infromation for addons
    useEffect(() => {
        addons.forEach((addon) => {
            const authorId = addon?.post_author || addon?.author_id;
            if (authorId && !authors[authorId]) {
                fetchAuthorInfo(authorId);
            }
        });
    }, [addons, authors, fetchAuthorInfo]);

    // Fetch the author information based on their ID
    const fetchAuthorInfo = async (authorId) => {
        try {
            const { data } = await axios.get(
                `${WEB_URL}/wp-json/wp/v2/public-user-info/${authorId}`
            );
            setAuthors((prevAuthors) => ({ ...prevAuthors, [authorId]: data }));
        } catch (error) {
            console.error(`Failed to fetch author info for ID ${authorId}`, error);
        }
    };

    // Make sure the addon author information is fetched before we try to display it
    useEffect(() => {
        if (activeTab === "myAddons" && Object.keys(installedAddons).length > 0) {
            Object.values(installedAddons).forEach((addon) => {
                const authorId = addon?.post_author || addon?.author_id;
                if (authorId && !authors[authorId]) {
                    fetchAuthorInfo(authorId);
                }
            });
        }
    }, [activeTab, installedAddons, authors]);

    useEffect(() => {
        if (activeTab === "browseAddons" && searchQuery === "") {
            fetchAddonsData(
                currentPage,
                "",
                selectedCategories.map((option) => option.value)
            );
        } else if (activeTab === "myAddons") {
            if (gameDir) {
                checkInstalledAddons(gameDir);
            }
        }
    }, [
        activeTab,
        currentPage,
        selectedCategories,
        fetchAddonsData,
        searchQuery,
    ]);

    // Load the addon categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addon-categories`
                );
                setCategories(response.data);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };

        fetchCategories();
    }, []);

    // Logic for showing addon creators
    const renderAddonAuthor = (addon, hideImage = false) => {
        const isAuthorCreator = addon?.custom_fields?.iam_creator === "1";
        const creatorName = addon?.custom_fields?.creator;
        const authorId = addon?.post_author || addon?.author_id;
        const authorData = authors[authorId];

        if (!authorData) {
            return <span>Loading...</span>;
        }

        const authorName = isAuthorCreator && authorData
            ? authorData.display_name
            : creatorName || "N/A";

        if (hideImage && (authorName === "Unknown" || authorName === "N/A")) {
            return <span>Unknown</span>;
        }

        if (hideImage) {
            return <span>{authorName}</span>;
        }

        const avatarUrl =
            isAuthorCreator && authorData
                ? authorData.avatar_url
                : "public/no-avatar.jpg";

        return (
            <div className="d-flex align-items-center gap-2">
                <img
                    src={avatarUrl}
                    alt={authorName}
                    className="img-fluid"
                    width={15}
                    height={15}
                />
                <span>{authorName}</span>
            </div>
        );
    };

    const handleCategoryChange = async (selectedOptions) => {
        setSelectedCategories(selectedOptions);
        const categoryIds = selectedOptions.map((option) => option.value);

        if (categoryIds.length > 0) {
            setSearchQuery(""); // Clear search query when filtering by categories
            await fetchAddonsData(1, "", categoryIds, selectedSorting.value);
        } else {
            await fetchAddonsData(1, "", [], selectedSorting.value); // Pass an empty array for categories if none are selected
        }
    };

    const handleSortingChange = async (selectedOption) => {
        setSelectedSorting(selectedOption);
        setPreviousSorting(selectedOption); // Update previousSorting whenever sorting changes
        setCurrentPage(1); // Reset to page 1 when sorting changes
        await fetchAddonsData(
            1,
            searchQuery,
            selectedCategories.map((option) => option.value),
            selectedOption.value
        );
    };

    useEffect(() => {
        if (installedAddons && Object.keys(installedAddons).length > 0) {
            setLoading(false); // Ensure rendering only after the state is set
        }
    }, [installedAddons]);

    const currentPostType = `addon-${currentExpansion}`;
    const debouncedSearch = useDebouncedSearch(
        setLoading,
        setAddons,
        setTotalPages,
        setCurrentPage,
        selectedCategories,
        activeTab,
        setActiveTab,
        currentPostType,
        selectedSorting
    );

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearchQuery(value);

        if (value === "") {
            // Restore the previous sorting and page after clearing the search
            setSelectedSorting(previousSorting);
            setCurrentPage(previousPage);
            fetchAddonsData(
                previousPage,
                "",
                selectedCategories.map((option) => option.value),
                previousSorting.value
            );
        } else {
            // Store the current page and sorting before searching
            setPreviousPage(currentPage);
            setPreviousSorting(selectedSorting);
            debouncedSearch(value, pageSize);
        }
    };

    const handleViewAddon = async (addonParam) => {
        const addonToView = addonParam || contextMenu.addon;
        if (!addonToView) return;

        setShowModal(true);
        setSelectedAddon(null);
        setAddonLoading(true);

        try {
            const response = await axios.get(
                `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${addonToView.id}`
            );
            setSelectedAddon(response.data);
        } catch (error) {
            console.error("Error fetching addon details:", error);
            showToastMessage("Failed to load addon details.", "danger");
        } finally {
            setAddonLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedAddon(null);
    };

    /**
    * Finds all parent addons that contain the child's main folder in their folder_list.
    *
    * @param {object} childAddon - The installed addon whose parents we're finding.
    * @param {object} installedAddons - The full installedAddons object keyed by folder name.
    * @return {Array} Array of parent addons (each item is an addon object).
    */
    function findParentAddons(childAddon, installedAddons) {
        if (!childAddon?.custom_fields?.folder_list) return [];

        // Identify the child's main folder
        const mainFolderEntry = childAddon.custom_fields.folder_list.find(
            ([_, isMain]) => isMain === "1"
        );
        if (!mainFolderEntry) {
            return [];
        }
        const [childMainFolderName] = mainFolderEntry;

        // Check all installed addons to see if they contain that folder (and aren't the same addon)
        const parents = [];
        for (const key in installedAddons) {
            const possibleParent = installedAddons[key];
            if (!possibleParent?.custom_fields?.folder_list) continue;
            if (possibleParent.id === childAddon.id) continue; // exclude itself
            const hasChildFolder = possibleParent.custom_fields.folder_list.some(
                ([f]) => f === childMainFolderName
            );
            if (hasChildFolder) {
                parents.push(possibleParent);
            }
        }
        return parents;
    }

    /**
    * For a given "parent" addon, find all installed "child" addons that are
    * physically included in the parent's folder_list. 
    * 
    * The parent's folder_list might have multiple subfolders. Any installed
    * addon whose "main folder" is in that list is considered a "child".
    */
    function findChildAddons(parentAddon, installedAddons) {
        if (!parentAddon?.custom_fields?.folder_list) return [];

        // Gather all folder names from the parent's folder_list
        const parentFolders = parentAddon.custom_fields.folder_list.map(([f]) => f);

        // Then check each installed addon to see if that addon's main folder is in the parent's folder_list
        const children = [];
        for (const key in installedAddons) {
            const candidate = installedAddons[key];
            if (candidate.id === parentAddon.id) continue; // skip itself
            const mainFolderEntry = candidate.custom_fields?.folder_list?.find(
                ([_, isMain]) => isMain === "1"
            );
            if (!mainFolderEntry) continue;
            const [childMainFolder] = mainFolderEntry;

            // If the parent's folder list includes this child's main folder, we consider it a child
            if (parentFolders.includes(childMainFolder)) {
                children.push(candidate);
            }
        }
        return children;
    }

    /**
    * Recursively gather all sub-addons (direct and nested) under a given addon.
    * @param {object} parentAddon
    * @param {object} installedAddons
    * @returns {Set} a set of all nested addons
    */
    function gatherAllSubAddons(parentAddon, installedAddons) {
        const result = new Set();
        function recurse(currentAddon) {
            // Find immediate children:
            const children = findChildAddons(currentAddon, installedAddons);
            for (const child of children) {
                if (!result.has(child)) {
                    result.add(child);
                    recurse(child); // go deeper
                }
            }
        }
        recurse(parentAddon);
        return result;
    }

    // Decode HTML entities in a string
    const decodeHtmlEntities = (text) => {
        const textArea = document.createElement("textarea");
        textArea.innerHTML = text;
        return textArea.value;
    };

    const normalizeTitle = (title) => {
        if (!title) return "";

        const decodedTitle = decodeHtmlEntities(title).toLowerCase();

        // Strip WoW color codes, hyperlinks, textures, or other WoW-specific formatting
        let normalizedTitle = decodedTitle
            .replace(/\|c[0-9a-fA-F]{8}/g, "") // Removes |cxxxxxxxx (color codes)
            .replace(/\|r/g, "") // Removes |r (reset color code)
            .replace(/(\|H.*?\|h|\|T.*?\|t|\|A.*?\|a)/g, "") // Removes other WoW tags
            .replace(/[<>]/g, "") // Removes symbols like < and > that are often added in titles
            .replace(/\s+/g, " ") // Replace multiple spaces with a single space
            .replace(/[-\s]*Ace\d*[-\s]*/gi, "") // Remove common suffixes like " -Ace2-"
            .replace(
                /classic|retail|tbc|shadowlands|2024|2023|[-\s]*ace\d*[-\s]*/gi,
                ""
            ) // Remove common suffixes
            .replace(/[-\s]+$/, "") // Trim trailing dashes or spaces
            .replace(/v?\d+(\.\d+)*$/i, "") // Remove version numbers like "v3.7.1" or "3.7.1"
            .trim()
            .toLowerCase();

        // Normalize quotes and special characters
        normalizedTitle = normalizedTitle
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // Normalize single quotes
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // Normalize double quotes

        return normalizedTitle;
    };

    const handleInstallAddon = async (addon, event, isReinstall = false, skipBundledCheck = false) => {
        event.preventDefault();
        event.stopPropagation();

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

        try {
            setDownloading(true);
            setInstallingAddonId(addon.id);
            setInstallingAddonStep("Deleting previous folders");

            // Step 1: Handle Variations

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
            // const allAddonsToCheck = [mainAddon, ...relatedAddons.map(id => allAddons.find(a => a.id === id))];
            const currentlyInstalledAddon = Object.values(installedAddons).find(
                (installed) => {
                    // Check if the installed addon is the main addon or one of its variations
                    return (
                        installed.id === mainAddon.id ||
                        relatedAddons.includes(installed.id)
                    );
                }
            );
            //Skip bundled check if flag is true
            if (!skipBundledCheck) {
                // Check if main addon/variations have bundled addons
                const allAddonsToCheck = [mainAddon, ...relatedAddons.map(id => allAddons.find(a => a.id === id))];
                const bundledAddons = allAddonsToCheck.flatMap(parentAddon => {
                    return findChildAddons(parentAddon, installedAddons).filter(child => {
                        // Only consider children that are EXCLUSIVE to this parent
                        const childParents = findParentAddons(child, installedAddons);
                        return childParents.some(p => p.id === parentAddon.id);
                    });
                });

                const findStandaloneCopies = (mainAddon, installedAddons) => {
                    // Get main addon's root parent
                    const getRootParent = (addon) => {
                        if (addon.custom_fields?.variation && addon.custom_fields.variation !== "0") {
                            const parent = allAddons.find(a => a.id === parseInt(addon.custom_fields.variation));
                            return parent ? getRootParent(parent) : addon;
                        }
                        return addon;
                    };

                    const mainRoot = getRootParent(mainAddon);

                    return [...new Set(
                        Object.values(installedAddons).filter(installed => {
                            const installedRoot = getRootParent(installed);
                            return installedRoot.id !== mainRoot.id &&
                                installed.custom_fields.folder_list.some(([f]) =>
                                    mainAddon.custom_fields.folder_list.some(([mf]) => mf === f)
                                );
                        })
                    )];
                };

                if (bundledAddons.length > 0 && !skipBundledCheck) {
                    // Show deletion modal
                    setDeleteModalData({
                        addon: currentlyInstalledAddon,
                        newAddon: mainAddon,
                        parents: [],
                        children: bundledAddons,
                        isInstallation: true,
                        standaloneAddons: findStandaloneCopies(mainAddon, installedAddons)
                    });
                    setShowDeleteModal(true);
                    setShowModal(false);
                    return;
                }

            }

            // Delete folders from main addon + all variations
            const addonsToDelete = [mainAddon.id, ...relatedAddons];

            await Promise.all(
                addonsToDelete.map(async (relatedAddonId) => {
                    const installedAddon = Object.values(installedAddons).find(
                        (installed) => installed.id === parseInt(relatedAddonId, 10)
                    );

                    if (installedAddon) {
                        const foldersToDelete =
                            installedAddon.custom_fields.folder_list.map(
                                ([folderName]) => folderName
                            );

                        await Promise.all(
                            foldersToDelete.map(async (folder) => {
                                const folderPath = window.electron.pathJoin(installPath, folder);

                                // Get ALL installed addons using this folder
                                const folderUsers = Object.values(installedAddons).filter(installed =>
                                    installed.custom_fields.folder_list.some(([f]) => f === folder)
                                );

                                const isSameFamily = folderUsers.some(installed => {
                                    // Recursive family check
                                    const getRootParent = (addon) => {
                                        if (addon.custom_fields?.variation && addon.custom_fields.variation !== "0") {
                                            const parent = allAddons.find(a => a.id === parseInt(addon.custom_fields.variation));
                                            return parent ? getRootParent(parent) : addon;
                                        }
                                        return addon;
                                    };

                                    const installedRoot = getRootParent(installed);
                                    const mainAddonRoot = getRootParent(mainAddon);

                                    return installedRoot.id === mainAddonRoot.id;
                                });

                                if (!isSameFamily) {
                                    console.log(`Preserving unrelated folder: ${folder}`);
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
                                const isFolderUsed = Object.values(installedAddons).some(ia =>
                                    ia.id !== installedAddon.id &&
                                    ia.custom_fields.folder_list.some(([f]) => f === folder)
                                );
                                if (isFolderUsed) {
                                    console.log(`Skipping ${folder} (used by another addon)`);
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
                                            `Attempt ${attempt + 1
                                            } to delete folder ${folderPath} failed. Retrying...`
                                        );
                                        // Reduce the delay time for retries to speed up the process
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

            // Step 3: Download and extract the new addon
            setInstallingAddonStep("Downloading addon...");
            const response = await axios.get(addonUrl, {
                responseType: "blob",
                onDownloadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setProgress(percentCompleted);
                },
            });

            const fileName = addonUrl.split("/").pop();
            const zipFilePath = await window.electron.saveZipFile(
                response.data,
                fileName
            );
            await window.electron.extractZip(zipFilePath, installPath);

            // Step 4: Write the .warperia file with correct information
            const mainFolder = addon.custom_fields.folder_list.find(
                ([_, isMain]) => isMain === "1"
            );
            if (!mainFolder) {
                console.error("Main folder not found for addon:", addonTitle);
                showToastMessage(`Main folder not found for "${addonTitle}"`, "danger");
                return;
            }

            const [mainFolderName] = mainFolder;
            const mainFolderPath = `${installPath}\\${mainFolderName}`;
            const tocFilePath = `${mainFolderPath}\\${mainFolderName}.toc`;

            // Ensure extraction is complete before writing the .warperia file
            await new Promise((resolve) => setTimeout(resolve, 500));

            if (await window.electron.fileExists(tocFilePath)) {
                const versionFromToc =
                    (await window.electron.readVersionFromToc(tocFilePath)) || "1.0.0";

                // Double-check that no old data is left before writing the new file
                const warperiaFilePath = `${mainFolderPath}\\${mainFolderName}.warperia`;
                await window.electron.deleteFolder(warperiaFilePath); // Delete old .warperia
                const warperiaContent = `ID: ${addon.id
                    }\nFolders: ${addon.custom_fields.folder_list
                        .map(([folderName]) => folderName)
                        .join(",")}\nFilename: ${addonUrl.split("/").pop()}`;
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
                } else {
                }

                const backendVersion = addon.custom_fields.version || versionFromToc;
                await window.electron.updateTocVersion(mainFolderPath, backendVersion);

            } else {
                console.warn(
                    `No .toc file found in main folder "${mainFolderName}", defaulting to version 1.0.0.`
                );
            }

            await updateAddonInstallStats(addon.id, addon.post_type);
            await checkInstalledAddons(gameDir);
        } catch (error) {
            console.error("Error installing addon:", error);
            showToastMessage(`Failed to install "${addon.title}".`, "danger");
        } finally {
            if (!modalShown) {
                setTimeout(() => {
                    setDownloading(false);
                    setProgress(0);
                    setInstallingAddonId(null);
                }, 1500);
            }
        }
    };

    const checkInstalledAddons = async (gamePath) => {
        try {
            setScanningAddons(true);

            // 1) Normalize the path to Interface/AddOns
            const absoluteGameDir = window.electron.pathResolve(gamePath);
            const addonsDir = window.electron.pathJoin(absoluteGameDir, "Interface", "AddOns");

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
                    const { data: batchAddons, totalPages: fetchedTotalPages } = await fetchAddons(
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

            // 6) Iterate over each folder in the user’s AddOns directory
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
                        const versionFromToc = await window.electron.readVersionFromToc(tocFile);
                        tocVersion = versionFromToc || tocVersion;
                    }

                    // Check for .warperia file to see if we can identify which exact addon ID was installed
                    const warperiaFile = window.electron.pathJoin(folderPath, `${folder}.warperia`);
                    const warperiaExists = await window.electron.fileExists(warperiaFile);

                    // Create the .warperia file if it doesn't exist
                    if (!warperiaExists && matchingAddons.length === 1) {
                        const matchedAddon = matchingAddons[0];
                        try {
                            const warperiaContent = `ID: ${matchedAddon.id}\nFolders: ${matchedAddon.custom_fields.folder_list
                                .map(([f]) => f)
                                .join(",")
                                }\nFilename: ${matchedAddon.custom_fields.file.split("/").pop()}`;

                            await window.electron.writeFile(warperiaFile, warperiaContent);
                        } catch (error) {
                            console.error(`Failed to create .warperia file for ${folder}:`, error);
                        }
                    }

                    let storedFilename = "";

                    if (await window.electron.fileExists(warperiaFile)) {
                        const warperiaContent = await window.electron.readFile(warperiaFile);
                        const installedAddonId = warperiaContent.match(/ID:\s*(\d+)/)?.[1];
                        const filenameMatch = warperiaContent.match(/Filename:\s*(.+)/);
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

                                await window.electron.overwriteFile(warperiaFile, newWarperiaContent);
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
                                };
                                return; // Done with this folder
                            }
                        }
                    }

                    // If there's exactly one matching addon, no conflict
                    if (matchingAddons.length === 1) {
                        const matchedAddon = matchingAddons[0];
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

            // 8) Update our state for all installed addons we confidently matched
            setInstalledAddons({ ...matchedAddons });

        } catch (error) {
            console.error("Error checking installed addons:", error);
        } finally {
            setScanningAddons(false);
        }
    };

    const handleSelectAddon = async (selectedAddon) => {
        const installPath = window.electron.pathJoin(
            gameDir,
            "Interface",
            "AddOns"
        );
        // Validate installPath
        if (!isPathInsideDirectory(installPath, gameDir)) {
            console.error("Invalid install path:", installPath);
            showToastMessage("Invalid install path.", "danger");
            return;
        }

        // Gather all folder names from similar addons to ensure proper deletion
        const allFolderNames = currentModalData.flatMap((addon) =>
            addon.custom_fields.folder_list.map(([folderName]) => folderName)
        );

        try {
            // Delete all associated folders from the conflicting addons before installing the new one
            for (const folderName of allFolderNames) {
                const folderPath = `${installPath}\\${folderName}`;
                await window.electron.deleteFolder(folderPath);
            }

            // Proceed with installing the selected addon as usual
            const addonUrl = selectedAddon.custom_fields.file;
            if (!addonUrl) {
                console.error("The source URL for this addon couldn't be found.");
                showToastMessage(
                    "The source URL for this addon couldn't be found.",
                    "danger"
                );
                return;
            }

            setDownloading(true);
            setInstallingAddonId(selectedAddon.id);

            const response = await axios.get(addonUrl, {
                responseType: "blob",
                onDownloadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setProgress(percentCompleted);
                },
            });

            // Save and extract the zip
            const fileName = addonUrl.split("/").pop();
            const zipFilePath = await window.electron.saveZipFile(
                response.data,
                fileName
            );
            setInstallingAddonStep("Extracting files");
            await window.electron.extractZip(zipFilePath, installPath);

            // Write the .warperia file to indicate the addon is installed
            const mainFolder = selectedAddon.custom_fields.folder_list.find(
                ([_, isMain]) => isMain === "1"
            )[0];
            const warperiaFilePath = `${installPath}\\${mainFolder}\\${mainFolder}.warperia`;

            await window.electron.writeFile(
                warperiaFilePath,
                `ID: ${selectedAddon.id
                }\nFolders: ${selectedAddon.custom_fields.folder_list
                    .map(([folderName]) => folderName)
                    .join(",")}`
            );
            setInstallingAddonStep("Finalizing installation");

            // Update the UI to reflect the installed addon
            const updatedAddons = { ...installedAddons };
            updatedAddons[mainFolder] = selectedAddon;
            setInstalledAddons(updatedAddons);

            // Process the next modal in the queue, if available
            const updatedQueue = modalQueue.slice(1);
            if (updatedQueue.length > 0) {
                setCurrentModalData(updatedQueue[0]);
                setModalQueue(updatedQueue);
            } else {
                setShowAddonSelectionModal(false);
            }

            showToastMessage(
                `"${decodeHtmlEntities(selectedAddon.title)}" installed successfully.`,
                "success"
            );
        } catch (error) {
            console.error("Error installing addon after selection:", error);
            showToastMessage(
                `Failed to install "${decodeHtmlEntities(selectedAddon.title)}".`,
                "danger"
            );
        } finally {
            setTimeout(() => {
                setDownloading(false);
                setProgress(0);
                setInstallingAddonId(null);
                setInstallingAddonStep(null);
            }, 1500);
        }
    };

    const handleCancelAddonSelection = () => {
        setShowAddonSelectionModal(false);
    };

    const handleReinstallAddon = () => {
        if (contextMenu.addon) {
            handleInstallAddon(contextMenu.addon, new Event("click"), true);
            setContextMenu({ visible: false, xPos: 0, yPos: 0, addon: null });
        }
    };

    const handleDeleteAddon = async () => {
        if (!contextMenu.addon) return;

        const mainAddon = contextMenu.addon;

        // Gather parents and sub-addons
        const parents = findParentAddons(mainAddon, installedAddons);
        const allSubAddons = gatherAllSubAddons(mainAddon, installedAddons);
        const nestedAddonsArray = Array.from(allSubAddons);

        // If there are parents or nested sub-addons, show the modal and RETURN
        if (parents.length > 0 || nestedAddonsArray.length > 0) {
            setDeleteModalData({
                addon: mainAddon,
                parents,
                children: nestedAddonsArray
            });
            setShowDeleteModal(true);
            return;
        }

        // If no parents or nested sub-addons, proceed with direct deletion
        try {
            const folderList = contextMenu.addon.custom_fields.folder_list || [];
            const addonFolders = await window.electron.readDir(
                `${gameDir}\\Interface\\AddOns`
            );
            const normalizedTitle = normalizeTitle(
                contextMenu.addon.custom_fields.title_toc ||
                contextMenu.addon.title ||
                ""
            );

            let foldersToDelete = [];

            for (let folder of addonFolders) {
                const tocFile = `${gameDir}\\Interface\\AddOns\\${folder}\\${folder}.toc`;

                if (await window.electron.fileExists(tocFile)) {
                    const title = await window.electron.readTitleFromToc(tocFile);
                    const normalizedFolderTitle = normalizeTitle(title || folder);

                    if (normalizedFolderTitle === normalizedTitle) {
                        foldersToDelete.push(folder);
                    }
                }
            }

            // Include any folders from the addon’s folder_list
            folderList.forEach(([relatedFolder]) => {
                if (
                    !foldersToDelete.includes(relatedFolder) &&
                    addonFolders.includes(relatedFolder)
                ) {
                    foldersToDelete.push(relatedFolder);
                }
            });

            if (foldersToDelete.length > 0) {
                for (const folder of foldersToDelete) {
                    const addonFolder = `${gameDir}\\Interface\\AddOns\\${folder}`;
                    await window.electron.deleteFolder(addonFolder);
                }

                showToastMessage(
                    `"${decodeHtmlEntities(
                        contextMenu.addon.title
                    )}" and related folders deleted successfully.`,
                    "success"
                );
                await checkInstalledAddons(gameDir);
                await updateAddonUninstallStats(
                    contextMenu.addon.id,
                    contextMenu.addon.post_type
                );
            } else {
                showToastMessage(
                    `Failed to find folders for "${decodeHtmlEntities(
                        contextMenu.addon.title
                    )}".`,
                    "danger"
                );
            }
        } catch (error) {
            console.error("Error deleting addon:", error);
            showToastMessage(
                `Failed to delete "${decodeHtmlEntities(contextMenu.addon.title)}".`,
                "danger"
            );
        }
    };

    // Confirm addon deletion for bundles (dependencies)
    async function confirmDeleteAddons(selectedSubAddonIds) {
        const originalAddonId = installingAddonId;
        const mainAddon = deleteModalData.addon;
        const targetAddon = deleteModalData.newAddon;
        if (!mainAddon) return;

        // Reset state immediately before installation
        setDownloading(false);
        setProgress(0);
        setInstallingAddonId(null);
        setShowDeleteModal(false);

        if (targetAddon) {
            await handleInstallAddon(targetAddon, new Event("click"), true, true);
        }

        if (originalAddonId) {
            const addonToInstall = allAddons.find(a => a.id === originalAddonId);
            if (addonToInstall) {
                await handleInstallAddon(addonToInstall, new Event("click"), true, true);
            }
        }

        try {
            // Get target variation from modal data
            const targetVariation = deleteModalData.newAddon;

            // Install the new variation AFTER confirmation
            if (targetVariation) {
                await handleInstallAddon(targetVariation, new Event("click"), true, true);
            }

            // Build the set of addon IDs we are actually deleting
            const allToDelete = new Set([mainAddon.id, ...selectedSubAddonIds]);

            // Which installedAddons match that set?
            const addonsToDelete = Object.values(installedAddons).filter(
                (a) => allToDelete.has(a.id)
            );

            // Get quick access to all installed addons by their main folder
            // so we can detect if we're about to remove the main folder of an addon the user wants to keep
            const mainFolderMap = {};
            for (const candidate of Object.values(installedAddons)) {
                // Each installed addon might have a main folder
                const mainFolderEntry = candidate.custom_fields?.folder_list?.find(
                    ([_, isMain]) => isMain === "1"
                );
                if (mainFolderEntry) {
                    const [candidateMainFolder] = mainFolderEntry;
                    mainFolderMap[candidateMainFolder] = candidate.id;
                }
            }

            // Read all current folders once
            const addonFolders = await window.electron.readDir(`${gameDir}\\Interface\\AddOns`);

            // For each addon we *are* deleting, remove its matching folders
            for (const ad of addonsToDelete) {
                const folderList = ad.custom_fields.folder_list || [];
                const normalizedTitle = normalizeTitle(
                    ad.custom_fields.title_toc || ad.title || ""
                );

                let foldersToDelete = [];

                // Attempt to match by .toc name
                for (const folder of addonFolders) {
                    const tocFile = `${gameDir}\\Interface\\AddOns\\${folder}\\${folder}.toc`;
                    if (await window.electron.fileExists(tocFile)) {
                        const title = await window.electron.readTitleFromToc(tocFile);
                        const normalizedFolderTitle = normalizeTitle(title || folder);
                        if (normalizedFolderTitle === normalizedTitle) {
                            foldersToDelete.push(folder);
                        }
                    }
                }

                // Include any folders from the addon's folder_list
                folderList.forEach(([relatedFolder]) => {
                    if (!foldersToDelete.includes(relatedFolder) && addonFolders.includes(relatedFolder)) {
                        foldersToDelete.push(relatedFolder);
                    }
                });

                // Before removing each folder, skip it if it’s the main folder of a sub‐addon the user *didn't* select for deletion
                foldersToDelete = foldersToDelete.filter((folderName) => {
                    const possibleSubAddonId = mainFolderMap[folderName];
                    // If this folder is *not* someone's main folder, we can safely remove it
                    if (!possibleSubAddonId) return true;

                    // If it *is* someone's main folder but that sub‐addon is also in allToDelete, it's OK to remove
                    if (allToDelete.has(possibleSubAddonId)) return true;

                    // Otherwise, skip removing this folder because that sub‐addon was kept
                    return false;
                });

                // Actually remove them
                for (const folderName of foldersToDelete) {
                    const folderPath = `${gameDir}\\Interface\\AddOns\\${folderName}`;
                    await window.electron.deleteFolder(folderPath);
                }
            }

            showToastMessage(`Successfully deleted addon(s).`, "success");
            await checkInstalledAddons(gameDir);

            // If this was triggered during an installation, proceed with the installation
            if (installingAddonId) {
                const addonToInstall = allAddons.find(a => a.id === installingAddonId);
                if (addonToInstall) {
                    await handleInstallAddon(addonToInstall, new Event("click"), true, true);
                }
            }
        } catch (error) {
            console.error("Error deleting addon(s):", error);
            showToastMessage("Failed to delete addon(s).", "danger");
        }
    }

    // Unserialize the JSON code for the addon variations
    const parseSerializedPHPArray = (serializedData) => {
        if (!serializedData) return [];

        // Handle direct arrays (common in REST API)
        if (Array.isArray(serializedData)) return serializedData;

        // Handle PHP-serialized strings (e.g., "a:1:{i:0;i:3268;}")
        const regex = /i:\d+;i:(\d+);/g;
        const matches = [];
        let match;
        while ((match = regex.exec(serializedData)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    };

    const openSwitchVariationModal = async (addon) => {
        try {
            setCurrentAddon(addon);
            setShowSwitchModal(true);
            setLoadingVariations(true);

            let mainAddon = addon;
            let variationIds = [];

            // Check if this addon is a variation
            if (
                addon.custom_fields?.variation &&
                addon.custom_fields.variation !== "0" &&
                addon.custom_fields.variation !== ""
            ) {
                // Fetch the main addon if this is a variation
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${addon.custom_fields.variation}`
                );
                mainAddon = response.data;
            }

            // Add the main addon to the variations list
            const variations = [mainAddon];

            // Get variation IDs from the main addon
            const variationIdsArray = mainAddon.custom_fields?.has_variations || [];
            if (Array.isArray(variationIdsArray) && variationIdsArray.length > 0) {
                variationIds = variationIdsArray;
            }

            // Fetch the variations from the API
            for (const variationId of variationIds) {
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${variationId}`
                );
                variations.push(response.data);
            }

            // Set available variations (parent + variations)
            setAvailableVariations(variations);
        } catch (error) {
            console.error("Error fetching variations:", error);
            showToastMessage("Failed to load variations.", "danger");
        } finally {
            setLoadingVariations(false);
        }
    };

    const handleSwitchVariation = async (newVariation) => {
        if (!currentAddon) return;

        const bundledAddons = findChildAddons(currentAddon, installedAddons);

        if (bundledAddons.length > 0) {
            // Show delete confirmation first
            setDeleteModalData({
                addon: currentAddon,
                newAddon: newVariation, // Store target variation
                parents: [],
                children: bundledAddons,
                isInstallation: true
            });
            setShowDeleteModal(true);
            return; // Stop here until confirmation
        }

        try {
            // Delete the currently installed folders
            const installedFolders = currentAddon.custom_fields.folder_list.map(
                ([folderName]) => folderName
            );
            for (const folder of installedFolders) {
                const folderPath = window.electron.pathJoin(
                    gameDir,
                    "Interface",
                    "AddOns",
                    folder
                );
                await window.electron.deleteFolder(folderPath);
            }

            // Install the new variation
            await handleInstallAddon(newVariation, new Event("click"));

            // Update UI
            showToastMessage(
                `Switched to variation: ${newVariation.title}`,
                "success"
            );
            setShowSwitchModal(false);
            await checkInstalledAddons(gameDir);
        } catch (error) {
            console.error("Error switching variations:", error);
            showToastMessage("Failed to switch variations.", "danger");
        }
    };

    const openExportModal = () => setShowExportModal(true);
    const openImportModal = () => setShowImportModal(true);

    const closeExportModal = () => setShowExportModal(false);
    const closeImportModal = () => setShowImportModal(false);

    const handleImportAddons = async (addonIds) => {
        try {
            for (const id of addonIds) {
                const addon = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${id}`
                );
                await handleInstallAddon(addon.data, new Event("click"));
            }
            showToastMessage("Addons imported successfully!", "success");
        } catch (error) {
            showToastMessage(
                "Failed to import addons. Invalid export code.",
                "danger"
            );
        }
    };

    const handleUpdateAddon = async (addon) => {
        try {
            const installPath = `${gameDir}\\Interface\\AddOns`;

            // Get the main folder from the addon's folder list
            const mainFolder = addon.custom_fields.folder_list.find(
                ([_, isMain]) => isMain === "1"
            )[0];
            const mainFolderPath = `${installPath}\\${mainFolder}`;
            const tocFilePath = `${mainFolderPath}\\${mainFolder}.toc`;
            const warperiaFilePath = `${mainFolderPath}\\${mainFolder}.warperia`;

            // Read the current version from the .toc file
            const currentVersion = await window.electron.readVersionFromToc(
                tocFilePath
            );
            const backendVersion = addon.custom_fields.version || "1.0.0"; // Version from the backend

            // Read the .warperia file to get the stored filename
            let storedFilename = "";
            if (await window.electron.fileExists(warperiaFilePath)) {
                const warperiaContent = await window.electron.readFile(warperiaFilePath);
                const filenameMatch = warperiaContent.match(/Filename:\s*(.+)/);
                if (filenameMatch) {
                    storedFilename = filenameMatch[1];
                }
            }

            // Get the current filename from the backend
            const currentFilename = addon.custom_fields.file.split("/").pop();

            // Check if the versions differ or if the filenames differ
            if (currentVersion !== backendVersion || storedFilename !== currentFilename) {
                // Update the version in the .toc file if necessary
                await window.electron.updateTocVersion(mainFolderPath, backendVersion);

                // Update the .warperia file with the new filename
                const warperiaContent = `ID: ${addon.id}\nFolders: ${addon.custom_fields.folder_list
                    .map(([folderName]) => folderName)
                    .join(",")}\nFilename: ${currentFilename}`;
                await window.electron.writeFile(warperiaFilePath, warperiaContent);

                // Proceed with the usual addon update (reinstallation)
                await handleInstallAddon(addon, new Event("click"), true); // Reinstall to update
            } else {
                showToastMessage(
                    `The addon is already up-to-date: v${currentVersion}`,
                    "info"
                );
            }
        } catch (error) {
            console.error(`Error updating addon "${addon.title}":`, error);
            showToastMessage(`Failed to update "${addon.title}".`, "danger");
        }
    };

    const handleUpdateAllAddons = async () => {
        try {
            // Filter the addons that need updating
            const addonsToUpdate = Object.values(installedAddons).filter((addon) => {
                const installedVersion = addon.localVersion || "0.0.0"; // Local .toc version
                const backendVersion = addon.custom_fields.version || "0.0.0"; // Backend version
                const currentFilename = addon.custom_fields.file.split("/").pop();
                const storedFilename = addon.storedFilename || "";

                // Needs update if versions differ or filenames differ
                return backendVersion !== installedVersion || storedFilename !== currentFilename;
            });

            if (addonsToUpdate.length === 0) {
                showToastMessage("No addons need updating.", "info");
                return;
            }

            setDownloading(true);

            // Update each addon that requires an update
            for (const addon of addonsToUpdate) {
                await handleUpdateAddon(addon); // Call the update function for each addon
            }

            showToastMessage("All addons updated successfully.", "success");
            await checkInstalledAddons(gameDir); // Refresh the installed addons
        } catch (error) {
            console.error("Error updating all addons:", error);
            showToastMessage("Failed to update all addons.", "danger");
        } finally {
            setDownloading(false);
        }
    };

    const showToastMessage = useCallback((message, type) => {
        const newToast = { id: Date.now(), message, type };
        setToasts((prevToasts) => [...prevToasts, newToast]);

        setTimeout(() => {
            setToasts((prevToasts) =>
                prevToasts.filter((toast) => toast.id !== newToast.id)
            );
        }, 5000);
    }, []);

    const handleOpenAddonFolder = async (addon, folderName) => {
        try {
            if (!gameDir) {
                showToastMessage("Your game directory is not configured.", "danger");
                return;
            }

            // Construct full path
            const absoluteGameDir = window.electron.pathResolve(gameDir);
            const folderPath = window.electron.pathJoin(
                absoluteGameDir,
                "Interface",
                "AddOns",
                folderName
            );

            // Simple security check to ensure it's inside AddOns folder
            if (!isPathInsideDirectory(folderPath, absoluteGameDir)) {
                showToastMessage("Invalid folder path.", "danger");
                return;
            }

            // Invoke the IPC method in main.cjs to open the folder
            await window.electron.ipcRenderer.invoke('open-directory', folderPath);

        } catch (error) {
            console.error('Error opening addon folder:', error);
            showToastMessage("Failed to open folder.", "danger");
        }
    };

    const handleRightClick = (event, addon) => {
        event.preventDefault();

        const normalizedTitle = normalizeTitle(
            addon?.custom_fields.title_toc || addon.title || ""
        );

        // Check if the addon is installed by looking at installedAddons
        const isInstalled = Object.values(installedAddons).some(
            (installedAddon) => {
                const normalizedInstalledTitle = normalizeTitle(
                    installedAddon?.title || ""
                );
                const normalizedInstalledTocTitle = normalizeTitle(
                    installedAddon?.custom_fields?.title_toc || ""
                );

                return (
                    normalizedInstalledTitle === normalizedTitle ||
                    normalizedInstalledTocTitle === normalizedTitle
                );
            }
        );

        // Grab folder list directly from the addon 
        const folderList = addon?.custom_fields?.folder_list || [];

        setContextMenu({
            visible: true,
            xPos: event.pageX,
            yPos: event.pageY,
            addon,
            isInstalled,
            addonImage: addon.featured_image ?? 'public/default-image.jpg',
            addonName: addon.title,
            folderList
        });
    };

    const handleClickOutside = () => {
        setContextMenu({ visible: false, xPos: 0, yPos: 0, addon: null });
    };

    const handleReportAddon = () => {
        if (contextMenu.addon) {
            setCurrentAddonForReport(contextMenu.addon);
            setShowReportModal(true);
        }
    };

    const handleReportSubmit = async (details) => {
        if (!currentAddonForReport) return;

        try {
            const reportData = {
                title: `Report for Addon: ${currentAddonForReport.title}`,
                content: details,
                meta: {
                    addon_id: currentAddonForReport.id,
                    addon_name: currentAddonForReport.title,
                    addon_report_expansion: currentAddonForReport.post_type,
                    post_type: currentAddonForReport.post_type,
                    author_username: user?.username || "",
                },
            };

            const tokenResult = await window.electron.retrieveToken();
            if (tokenResult.success && tokenResult.token) {
                await axios.post(`${WEB_URL}/wp-json/wp/v2/addon-reports`, reportData, {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                    },
                });

                showToastMessage("Report submitted successfully.", "success");
            } else {
                showToastMessage("Failed to authenticate. Please try again.", "danger");
            }
        } catch (error) {
            console.error("Error submitting report:", error);
            showToastMessage("Failed to submit report.", "danger");
        } finally {
            setShowReportModal(false);
        }
    };

    // View addon on the website
    const handleViewOnWarperia = (addon) => {
        if (!addon) return;

        // Construct the URL for the addon on the backend website
        const addonUrl = `${addon.link}`;

        // Open the URL in the default browser using window.open
        window.open(addonUrl, '_blank');
    };

    useEffect(() => {
        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, []);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPreviousPage(currentPage); // Store the current page before changing
            setCurrentPage(newPage);
        }
    };

    const handleJumpToPage = (event) => {
        const pageNumber = parseInt(event.target.value, 10);
        if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    // Post type to version mapping
    const postTypeVersionMap = {
        "addon-vanilla": "1.12.1",
        "addon-tbc": "2.4.3",
        "addon-wotlk": "3.3.5",
        "addon-cata": "4.3.4",
        "addon-mop": "5.4.8",
    };

    // Render the list of addons
    const renderAddonsList = (addonsList) => {
        const combinedAddonsList =
            activeTab === "myAddons"
                ? { ...installedAddons, ...corruptedAddons }
                : addonsList;

        const uniqueAddons = Object.values(combinedAddonsList).reduce(
            (acc, addon) => {
                if (!acc.some((existingAddon) => existingAddon.id === addon.id)) {
                    acc.push(addon);
                }
                return acc;
            },
            []
        );

        // Sort addons needing updates to the top
        const sortedAddons = uniqueAddons.sort((a, b) => {
            const aVersion = a.localVersion || "0.0.0";
            const bVersion = b.localVersion || "0.0.0";
            const aNeedsUpdate =
                (a.custom_fields?.version && a.custom_fields.version !== aVersion) ||
                (a.storedFilename && a.custom_fields?.file && a.storedFilename !== a.custom_fields.file.split("/").pop()) ||
                a.corrupted;
            const bNeedsUpdate =
                (b.custom_fields?.version && b.custom_fields.version !== bVersion) ||
                (b.storedFilename && b.custom_fields?.file && b.storedFilename !== b.custom_fields.file.split("/").pop()) ||
                b.corrupted;

            if (aNeedsUpdate && !bNeedsUpdate) return -1;
            if (!aNeedsUpdate && bNeedsUpdate) return 1;
            return 0;
        });

        let finalAddons = sortedAddons;

        if (activeTab === "myAddons") {
            // Apply filtering if user typed something in the installed search
            if (installedSearchQuery && installedSearchQuery.trim().length > 0) {
                const searchTerm = installedSearchQuery.toLowerCase();

                finalAddons = finalAddons.filter((addon) => {
                    const rawTitle = addon.title || addon.custom_fields?.title_toc || "";
                    const addonTitle = decodeHtmlEntities(rawTitle).toLowerCase();
                    return addonTitle.includes(searchTerm);
                });
            }
        }

        if (activeTab === "myAddons") {
            return (
                <div className="table-responsive">
                    <table className="table table-addons-installed align-middle user-select-none mb-0">
                        <thead>
                            <tr>
                                <th scope="col">Name</th>
                                <th scope="col">Status</th>
                                <th scope="col">Latest Version</th>
                                <th scope="col">Game Version</th>
                                <th scope="col">Creator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalAddons.length === 0 && installedSearchQuery.trim().length > 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center text-muted">
                                        No results found for "{installedSearchQuery}".
                                    </td>
                                </tr>
                            ) : (
                                finalAddons.map((addon) => {
                                    const installedAddon =
                                        Object.values(installedAddons).find((installed) => installed.id === addon.id) || addon;
                                    const installedVersion = installedAddon.localVersion || "N/A";
                                    const backendVersion = installedAddon.custom_fields?.version || "N/A";
                                    const needsUpdate =
                                        (addon.custom_fields?.version && addon.custom_fields.version !== addon.localVersion) ||
                                        (addon.storedFilename && addon.custom_fields?.file && addon.storedFilename !== addon.custom_fields.file.split("/").pop()) ||
                                        addon.corrupted;
                                    const isCorrupted = installedAddon.corrupted;
                                    const addonImage = installedAddon.featured_image
                                        ? installedAddon.featured_image
                                        : "public/default-image.jpg";

                                    const postType = installedAddon.post_type || currentExpansion;
                                    const gameVersion = postTypeVersionMap[postType] || postType;

                                    // Figure out child addons
                                    const childAddons = findChildAddons(installedAddon, installedAddons);
                                    const isExpanded = expandedAddons.includes(installedAddon.id);

                                    // Build statusContent
                                    let statusContent;
                                    if (isCorrupted) {
                                        statusContent = (
                                            <button
                                                className="btn btn-primary"
                                                onClick={(e) => handleInstallAddon(installedAddon, e, true)}
                                                disabled={downloading && installingAddonId === installedAddon.id}
                                            >
                                                {downloading && installingAddonId === installedAddon.id ? (
                                                    <>
                                                        <span
                                                            className="spinner-border spinner-border-sm me-1"
                                                            role="status"
                                                            aria-hidden="true"
                                                        ></span>
                                                        Updating...
                                                    </>
                                                ) : (
                                                    "Update"
                                                )}
                                            </button>
                                        );
                                    } else if (needsUpdate) {
                                        statusContent = (
                                            <button
                                                className="btn btn-primary"
                                                onClick={(e) => handleInstallAddon(installedAddon, e, true)}
                                                disabled={downloading && installingAddonId === installedAddon.id}
                                            >
                                                {downloading && installingAddonId === installedAddon.id ? (
                                                    <>
                                                        <span
                                                            className="spinner-border spinner-border-sm me-1"
                                                            role="status"
                                                            aria-hidden="true"
                                                        ></span>
                                                        Updating...
                                                    </>
                                                ) : (
                                                    "Update"
                                                )}
                                            </button>
                                        );
                                    } else {
                                        statusContent = (
                                            <span className="text-muted fw-medium">
                                                <i className="bi bi-check-circle-fill text-success me-1"></i> Updated
                                            </span>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={installedAddon.id}>
                                            {/* Primary row for the parent addon */}
                                            <tr
                                                onContextMenu={(e) => handleRightClick(e, installedAddon)}
                                                onClick={() => handleViewAddon(installedAddon)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <img
                                                            src={addonImage}
                                                            alt={installedAddon.title}
                                                            className="img-fluid rounded"
                                                            style={{
                                                                width: "60px",
                                                                height: "60px",
                                                                objectFit: "cover",
                                                            }}
                                                            onContextMenu={(e) => handleRightClick(e, installedAddon)}
                                                        />

                                                        <div>
                                                            <div className="fw-medium">
                                                                {decodeHtmlEntities(installedAddon.title)}
                                                                {downloading && installingAddonId === addon.id && (
                                                                    <div
                                                                        className="spinner-border spinner-addon-title ms-2 text-muted"
                                                                        role="status"
                                                                    >
                                                                        <span className="visually-hidden">Loading...</span>
                                                                    </div>
                                                                )}
                                                                {/* Expand/Collapse caret, only if childAddons exist */}
                                                                {childAddons.length > 0 && (
                                                                    <Tippy
                                                                        content="Show dependencies"
                                                                        placement="auto"
                                                                        className="custom-tooltip"
                                                                    >
                                                                        <i
                                                                            className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"
                                                                                } text-muted ms-2 accordion-button rounded`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleAddonExpansion(installedAddon.id);
                                                                            }}
                                                                        />
                                                                    </Tippy>
                                                                )}
                                                            </div>
                                                            <div
                                                                className="text-muted fw-medium"
                                                                style={{ fontSize: "0.9rem" }}
                                                            >
                                                                {/* Variation switch UI if needed */}
                                                                <Tippy
                                                                    content="Installed version"
                                                                    placement="auto"
                                                                    className="custom-tooltip"
                                                                >
                                                                    <span>{installedVersion}</span>
                                                                </Tippy>
                                                                {((Array.isArray(addon.custom_fields?.has_variations) &&
                                                                    addon.custom_fields.has_variations.length > 0) ||
                                                                    (addon.custom_fields?.variation &&
                                                                        addon.custom_fields.variation !== "" &&
                                                                        addon.custom_fields.variation !== "0")) && (
                                                                        <Tippy
                                                                            content="Switch Addon Variation"
                                                                            placement="top"
                                                                            className="custom-tooltip"
                                                                        >
                                                                            <div
                                                                                className="btn btn-link"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openSwitchVariationModal(addon);
                                                                                }}
                                                                            >
                                                                                <i className="bi bi-arrow-left-right text-primary me-1"></i>{" "}
                                                                                Switch
                                                                            </div>
                                                                        </Tippy>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{statusContent}</td>
                                                <td className="text-muted fw-medium text-truncate">
                                                    {backendVersion}
                                                </td>
                                                <td className="text-muted fw-medium">{gameVersion}</td>
                                                <td className="text-muted fw-medium">
                                                    {renderAddonAuthor(installedAddon, true)}
                                                </td>
                                            </tr>

                                            {/* Accordion row for child addons (sub‐addons) */}
                                            {childAddons.length > 0 && isExpanded && (
                                                <tr>
                                                    <td colSpan={5} style={{ background: "#1b1b1b" }}>
                                                        <div className="p-3">
                                                            <div className="text-muted mb-2">
                                                                <small>
                                                                    The following addon(s) are bundled or dependencies of{" "}
                                                                    <strong>{decodeHtmlEntities(installedAddon.title)}</strong>:
                                                                </small>
                                                            </div>
                                                            {/* Render each child as a smaller "subrow" but keep the same columns for consistency */}
                                                            <table className="table table-sm table-dark-subaddons mb-0">
                                                                <tbody>
                                                                    {childAddons.map((child) => {
                                                                        const childImage = child.featured_image || "public/default-image.jpg";

                                                                        return (
                                                                            <tr
                                                                                key={child.id}
                                                                                style={{ cursor: "pointer" }}
                                                                                onClick={() => handleViewAddon(child)}
                                                                                onContextMenu={(e) => handleRightClick(e, child)}
                                                                            >
                                                                                <td>
                                                                                    <div className="d-flex align-items-center gap-2">
                                                                                        <img
                                                                                            src={childImage}
                                                                                            alt={child.title}
                                                                                            className="img-fluid rounded"
                                                                                            style={{
                                                                                                width: "40px",
                                                                                                height: "40px",
                                                                                                objectFit: "cover",
                                                                                            }}
                                                                                        />
                                                                                        <div>
                                                                                            <div className="d-block" style={{ fontSize: "0.95rem" }}>
                                                                                                {decodeHtmlEntities(child.title)}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Browse Addons
        return (
            <div
                className={`row ${activeTab === "myAddons" ? "g-4" : "g-3 row-cols-md-1 row-cols-xl-1"
                    }`}
            >
                {finalAddons.map((addon) => {
                    const installedAddon = Object.values(installedAddons).find(
                        (installed) => installed.id === addon.id
                    );

                    return (
                        <BrowseAddonCard
                            key={addon.id}
                            addon={addon}
                            installedAddon={installedAddon}
                            downloading={downloading}
                            installingAddonId={installingAddonId}
                            installingAddonStep={installingAddonStep}
                            progress={progress}
                            handleInstallAddon={handleInstallAddon}
                            handleUpdateAddon={handleUpdateAddon}
                            handleRightClick={handleRightClick}
                            renderAddonAuthor={renderAddonAuthor}
                            handleViewAddon={handleViewAddon}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            <div className="container position-relative" ref={containerRef}>
                {settings &&
                    settings.enable_ads_banner_top === 1 &&
                    settings.app_ads_image_banner_top && (
                        <section className="container py-3 text-center">
                            <img
                                src={settings.app_ads_image_banner_top}
                                alt="Top Banner Ad"
                                className="img-fluid"
                                draggable="false"
                                style={{ maxHeight: "150px", objectFit: "contain" }}
                            />
                        </section>
                    )}
                <div ref={mainHeaderRef} className="tab-content" id="addonTabsContent">
                    <div
                        className={`tab-pane fade ${activeTab === "myAddons" ? "show active" : ""
                            }`}
                        id="my-addons"
                        role="tabpanel"
                        aria-labelledby="my-addons-tab"
                    >
                        <div className="d-flex mb-3 sticky-top sticky-controls pt-2">
                            <div className="w-100 d-flex flex-wrap align-items-center gap-2">
                                <Tippy content="Update all addons" placement="auto">
                                    <span>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleUpdateAllAddons}
                                            disabled={
                                                Object.values(installedAddons).filter((addon) => {
                                                    const installedVersion = addon.localVersion || "0.0.0";
                                                    const backendVersion = addon.custom_fields.version || "0.0.0";
                                                    const currentFilename = addon.custom_fields.file.split("/").pop();
                                                    const storedFilename = addon.storedFilename || "";

                                                    // Disable the button if no addons need an update
                                                    return backendVersion !== installedVersion || storedFilename !== currentFilename;
                                                }).length === 0 || downloading
                                            }
                                        >
                                            {downloading ? (
                                                <>
                                                    <span
                                                        className="spinner-border spinner-border-sm me-1"
                                                        role="status"
                                                        aria-hidden="true"
                                                    ></span>
                                                    <span>Updating...</span>
                                                </>
                                            ) : (
                                                "Update All"
                                            )}
                                        </button>
                                    </span>
                                </Tippy>
                                <div className="ms-auto d-flex gap-2">
                                    <div className="searchbar-addons-installed position-relative">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search..."
                                            value={installedSearchQuery}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setInstalledSearchQuery(val);
                                            }}
                                        />
                                        <i className="bi bi-search position-absolute text-muted pe-none"></i>
                                    </div>
                                    <div className="dropdown">
                                        <button
                                            className="btn btn-secondary"
                                            type="button"
                                            id="exportImportDropdown"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                        >
                                            <i className="bi bi-copy me-1"></i> Sharing
                                        </button>
                                        <ul
                                            className="dropdown-menu dropdown-custom-dark"
                                            aria-labelledby="exportImportDropdown"
                                        >
                                            <li>
                                                <button
                                                    className="dropdown-item py-2"
                                                    onClick={openExportModal}
                                                >
                                                    Export Addons
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    className="dropdown-item py-2"
                                                    onClick={openImportModal}
                                                >
                                                    Import Addons
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                    <Tippy content="Refresh your addons" placement="auto">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={refreshAddonsData}
                                        >
                                            <i className="bi bi-arrow-clockwise me-1" style={{ verticalAlign: '-1px' }}></i> Refresh
                                        </button>
                                    </Tippy>
                                </div>
                            </div>
                        </div>
                        {initialLoading || scanningAddons ? (
                            <div className="text-center my-4">
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Scanning Addons...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {Object.keys(installedAddons).length === 0 ? (
                                    <div className="text-muted my-4">
                                        <p>We couldn't find any addons.</p>
                                    </div>
                                ) : (
                                    <>
                                        {renderAddonsList(
                                            Object.values(installedAddons)
                                                .map((installedAddon) => {
                                                    const matchedAddon = addons.find(
                                                        (addon) =>
                                                            normalizeTitle(addon.title) === normalizeTitle(installedAddon.title) ||
                                                            normalizeTitle(addon.custom_fields.title_toc) === normalizeTitle(installedAddon.title)
                                                    );
                                                    return matchedAddon ? matchedAddon : installedAddon;
                                                })
                                                .filter((addon) => {
                                                    // If user has typed at least 3 characters, filter results
                                                    if (installedSearchQuery && installedSearchQuery.length >= 3) {
                                                        const searchTerm = installedSearchQuery.toLowerCase();
                                                        const addonTitle = decodeHtmlEntities(addon.title).toLowerCase();
                                                        return addonTitle.includes(searchTerm);
                                                    }
                                                    // If search query is empty or less than 3 characters, show all
                                                    return true;
                                                })
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div
                        className={`tab-pane fade ${activeTab === "browseAddons" ? "show active" : ""
                            }`}
                        id="browse-addons"
                        role="tabpanel"
                        aria-labelledby="browse-addons-tab"
                    >
                        <div className="row justify-content-between gy-2 mb-4 sticky-top sticky-controls pt-2">
                            <div className="col-12 col-md-8">
                                <div className="searchbar-addons-browse position-relative">
                                    <input
                                        className="form-control mr-sm-2"
                                        type="search"
                                        placeholder="Search Addons..."
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                    />
                                    <i className="bi bi-search position-absolute text-muted pe-none"></i>
                                </div>
                            </div>
                            <div className="col-12 col-md-2">
                                <div className="addon-filter-input">
                                    <Select
                                        isMulti
                                        options={categories}
                                        value={selectedCategories}
                                        onChange={handleCategoryChange}
                                        placeholder="Categories"
                                        className="dark-select"
                                        classNamePrefix="warperia-select"
                                        noOptionsMessage={({ inputValue }) =>
                                            `No results for "${inputValue}"`
                                        }
                                    />
                                </div>
                            </div>
                            <div className="col-12 col-md-2">
                                <Select
                                    value={selectedSorting}
                                    options={sortingOptions}
                                    onChange={handleSortingChange}
                                    placeholder="Sort By"
                                    className="dark-select"
                                    classNamePrefix="warperia-select"
                                />
                            </div>
                        </div>
                        {loading ? (
                            <div className="text-center my-4">
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Loading Addons...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {addons.length > 0 ? (
                                    renderAddonsList(addons)
                                ) : (
                                    <p className="text-muted">No addons found.</p>
                                )}
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={handlePageChange}
                                    onJumpToPage={handleJumpToPage}
                                />
                            </>
                        )}
                    </div>
                </div>
                {settings &&
                    settings.enable_ads_banner_bottom === 1 &&
                    settings.app_ads_image_banner_bottom && (
                        <section className="container py-3 text-center">
                            <img
                                src={settings.app_ads_image_banner_bottom}
                                alt="Bottom Banner Ad"
                                className="img-fluid"
                                draggable="false"
                                style={{ maxHeight: "150px", objectFit: "contain" }}
                            />
                        </section>
                    )}
            </div>
            <ContextMenu
                xPos={contextMenu.xPos}
                yPos={contextMenu.yPos}
                onReinstall={
                    contextMenu.addon && contextMenu.isInstalled
                        ? handleReinstallAddon
                        : null
                }
                onInstall={
                    contextMenu.addon
                        ? handleInstallAddon
                        : null
                }
                onDelete={
                    contextMenu.addon && contextMenu.isInstalled
                        ? handleDeleteAddon
                        : null
                }
                onViewAddon={handleViewAddon}
                onViewOnWarperia={() => handleViewOnWarperia(contextMenu.addon)}
                onReport={handleReportAddon}
                visible={contextMenu.visible}
                isInstalled={contextMenu.isInstalled}
                addonImage={contextMenu.addonImage}
                addonName={contextMenu.addonName}
                addonData={contextMenu.addon}
                folderList={contextMenu.folderList}
                onOpenAddonFolder={handleOpenAddonFolder}
            />
            {showAddonSelectionModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <AddonSelectionModal
                        matchedAddons={currentModalData}
                        onSelectAddon={handleSelectAddon}
                        onCancel={handleCancelAddonSelection}
                    />
                </Suspense>
            )}
            {showSwitchModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <SwitchVariationModal
                        show={showSwitchModal}
                        onHide={() => setShowSwitchModal(false)}
                        availableVariations={availableVariations}
                        onSwitchVariation={handleSwitchVariation}
                        currentAddon={currentAddon}
                        loading={loadingVariations}
                        downloading={downloading}
                        installingAddonId={installingAddonId}
                        installingAddonStep={installingAddonStep}
                        progress={progress}
                    />
                </Suspense>
            )}
            {showExportModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <ExportModal
                        show={showExportModal}
                        onClose={closeExportModal}
                        installedAddons={installedAddons}
                        showToastMessage={showToastMessage}
                    />
                </Suspense>
            )}
            {showImportModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <ImportModal
                        show={showImportModal}
                        onClose={closeImportModal}
                        onImportAddons={handleImportAddons}
                        showToastMessage={showToastMessage}
                    />
                </Suspense>
            )}
            {showReportModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <ReportModal
                        show={showReportModal}
                        onClose={() => setShowReportModal(false)}
                        onSubmit={handleReportSubmit}
                        addonName={currentAddonForReport?.title}
                    />
                </Suspense>
            )}
            {showDeleteModal && deleteModalData.addon && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <DeleteConfirmationModal
                        show={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        onConfirmDelete={confirmDeleteAddons}
                        addonToDelete={deleteModalData.addon}
                        newAddon={deleteModalData.newAddon}
                        parentWarnings={deleteModalData.parents}
                        nestedAddons={deleteModalData.children}
                        isInstallation={deleteModalData.isInstallation}
                    />
                </Suspense>
            )}

            {showModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <AddonModal
                        show={showModal}
                        onHide={handleCloseModal}
                        addon={selectedAddon}
                        loading={addonLoading}
                        installedAddon={Object.values(installedAddons).find(a => a.id === selectedAddon?.id)}
                        downloading={downloading}
                        installingAddonId={installingAddonId}
                        installingAddonStep={installingAddonStep}
                        progress={progress}
                        onInstall={handleInstallAddon}
                        onReinstall={(addon, e) => handleInstallAddon(addon, e, true)}
                    />
                </Suspense>
            )}

            <ToastNotifications
                toasts={toasts}
                onRemoveToast={(toastId) =>
                    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== toastId))
                }
            />
        </div>
    );
};

export default AddonsPage;