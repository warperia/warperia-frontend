import React, { useState, useEffect, useRef } from 'react';
import "bootstrap-icons/font/bootstrap-icons.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Navigation, Pagination } from 'swiper/modules';
import axios from 'axios';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { WEB_URL } from './../../../config.js';

const decodeHtmlEntities = (text) => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
};

const parseSerializedArray = (serializedString) => {
    const regex = /i:(\d+);/g;
    const matches = [...serializedString.matchAll(regex)];
    return matches.map(match => parseInt(match[1], 10)).filter(id => id > 0);
};

const AddonModal = ({ show, onHide, addon, loading, installedAddon, downloading, installingAddonId, installingAddonStep, progress, onInstall, onReinstall }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImage, setCurrentImage] = useState(null);
    const [activeTab, setActiveTab] = useState('description');
    const [developers, setDevelopers] = useState([]);
    const modalRef = useRef(null); // Reference to the modal content
    const isInstalled = !!installedAddon;
    const isInstalling = downloading && installingAddonId === addon?.id;

    const hasScreenshots = addon?.custom_fields?.screenshots?.length > 0 || addon?.featured_image;
    const hasWebsiteLink = addon?.custom_fields?.website_link && addon.custom_fields.website_link.trim() !== '';

    const postType = addon?.post_type || '';
    let expansionPrefix = '';

    if (postType === 'vanilla-addons') expansionPrefix = 'v_';
    else if (postType === 'tbc-addons') expansionPrefix = 't_';
    else if (postType === 'wotlk-addons') expansionPrefix = 'w_';
    else if (postType === 'cata-addons') expansionPrefix = 'c_';
    else if (postType === 'mop-addons') expansionPrefix = 'm_';

    const openLightbox = (image) => {
        setCurrentImage(image);
        setLightboxOpen(true);
    };

    const closeLightbox = () => {
        setLightboxOpen(false);
        setCurrentImage(null);
    };

    const handleOutsideClick = (event) => {
        if (lightboxOpen) return; // Ignore clicks when the lightbox is open
        if (modalRef.current && !modalRef.current.contains(event.target)) {
            onHide();
        }
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && lightboxOpen) {
                closeLightbox();
            } else if (event.key === 'Escape' && show) {
                onHide();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleOutsideClick);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [lightboxOpen, show, onHide]);

    useEffect(() => {
        const fetchDevelopers = async () => {
            const developersField = addon?.custom_fields?.[`${expansionPrefix}developers`];

            if (developersField) {
                let developerIds = [];

                try {
                    developerIds = parseSerializedArray(developersField);

                    const uniqueDeveloperIds = [...new Set(developerIds)];

                    if (uniqueDeveloperIds.length > 0) {
                        const responses = await Promise.all(
                            uniqueDeveloperIds.map(id =>
                                axios.get(`${WEB_URL}/wp-json/wp/v2/public-user-info/${id}`).catch(error => {
                                    console.error(`Error fetching user with ID ${id}:`, error);
                                    return null;
                                })
                            )
                        );
                        setDevelopers(responses.filter(res => res && res.status === 200).map(res => res.data));
                    }
                } catch (error) {
                    console.error("Error deserializing or fetching developers:", error);
                }
            }
        };

        fetchDevelopers();
    }, [addon, expansionPrefix]);

    const renderOriginalCreator = () => {
        const isAuthorCreator = addon?.custom_fields?.[`${expansionPrefix}iam_creator`] === '1';
        const creatorName = decodeHtmlEntities(addon?.custom_fields?.[`${expansionPrefix}creator`] || 'Unknown');
        const authorAvatarUrl = addon?.author_avatar_url || 'public/no-avatar.jpg';

        if (isAuthorCreator) {
            return (
                <div className="item-developer d-flex align-items-center rounded">
                    <img
                        src={authorAvatarUrl}
                        alt={addon?.author_name || 'Unknown'}
                        className="img-fluid rounded-circle me-2"
                        width={50}
                        height={50}
                    />
                    <span>{addon?.author_name || 'Unknown'}</span>
                </div>
            );
        } else {
            return (
                <div className="item-developer d-flex align-items-center rounded">
                    <img
                        src="public/no-avatar.jpg"
                        alt="Original Creator"
                        className="img-fluid rounded-circle me-2"
                        width={50}
                        height={50}
                    />
                    <span>{creatorName}</span>
                </div>
            );
        }
    };

    const renderAdditionalDevelopers = () => {
        if (developers.length === 0) {
            return <p>No additional developers available.</p>;
        }

        return developers.map((developer, index) => (
            <div key={index} className="item-developer d-flex align-items-center mb-3 rounded">
                <img src={developer.avatar_url} alt={developer.display_name} className="rounded-circle me-3" width={50} height={50} />
                <span>{developer.display_name}</span>
            </div>
        ));
    };

    if (!addon && !loading) return null;

    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div className={`modal ${show ? 'show' : ''}`} tabIndex="-1" style={{ display: show ? 'block' : 'none' }}>
                <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl modal-dark modal-fixed-height" ref={modalRef}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <div className="addon-header d-flex align-items-center pb-3 w-100">
                                <div className="addon-logo">
                                    {addon?.featured_image && (
                                        <img src={addon.featured_image} className="img-fluid rounded-circle" draggable="false" alt={addon.title} />
                                    )}
                                </div>
                                <div className="addon-meta d-flex flex-column flex-grow-1">
                                    <div className="name">
                                        <h4 className="fw-bold mb-0">{addon?.title}</h4>
                                    </div>
                                    <div className="categories">
                                        {addon?.addon_categories && addon.addon_categories.length > 0 ? (
                                            addon.addon_categories.map((category, index) => (
                                                <span key={index} className="text-muted fw-medium me-1">
                                                    {decodeHtmlEntities(category)}{index < addon.addon_categories.length - 1 && ', '}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-muted">No categories available</span>
                                        )}
                                    </div>
                                </div>
                                <div className="ms-auto">
                                    {!loading && addon && (
                                        <div className="install-controls">
                                            {downloading && installingAddonId === addon.id ? (
                                                <div className="addon-progress">
                                                    <div className="fw-medium text-muted mb-2">
                                                        {installingAddonStep}
                                                    </div>
                                                    <div className="progress rounded-0" style={{ minWidth: '200px' }}>
                                                        <div
                                                            className="progress-bar progress-bar-animated fw-bold"
                                                            role="progressbar"
                                                            style={{ width: `${progress}%` }}
                                                            aria-valuenow={progress}
                                                            aria-valuemin="0"
                                                            aria-valuemax="100"
                                                        >
                                                            {progress}%
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    className={`btn ${installedAddon ? 'btn-outline-secondary-2 rounded-0' : 'btn-primary rounded-0'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        installedAddon ? onReinstall(addon, e) : onInstall(addon, e);
                                                    }}
                                                    disabled={downloading}
                                                >
                                                    {installedAddon ? 'Reinstall' : 'Install'}
                                                    {downloading && installingAddonId === addon.id && (
                                                        <span className="spinner-border spinner-border-sm ms-2" role="status"></span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-body">
                            {loading ? (
                                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                                    <div className="spinner-border" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <ul className="nav nav-tabs">
                                        <li className="nav-item">
                                            <button
                                                className={`nav-link ${activeTab === 'description' ? 'active' : ''}`}
                                                onClick={() => setActiveTab('description')}
                                            >
                                                Description
                                            </button>
                                        </li>
                                        {hasScreenshots && (
                                            <li className="nav-item">
                                                <button
                                                    className={`nav-link ${activeTab === 'images' ? 'active' : ''}`}
                                                    onClick={() => setActiveTab('images')}
                                                >
                                                    Images
                                                </button>
                                            </li>
                                        )}
                                        <li className="nav-item">
                                            <button
                                                className={`nav-link ${activeTab === 'developers' ? 'active' : ''}`}
                                                onClick={() => setActiveTab('developers')}
                                            >
                                                Developers
                                            </button>
                                        </li>
                                        {hasWebsiteLink && (
                                            <li className="nav-item">
                                                <a
                                                    className="nav-link"
                                                    href={addon.custom_fields.website_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Source <i className="bi bi-box-arrow-up-right ms-1"></i>
                                                </a>
                                            </li>
                                        )}
                                    </ul>

                                    <div className="tab-content mt-3">
                                        {activeTab === 'description' && (
                                            <div className="tab-pane fade show active">
                                                <div className="addon-content fw-medium my-3" dangerouslySetInnerHTML={{ __html: addon.content }}></div>
                                            </div>
                                        )}
                                        {activeTab === 'images' && hasScreenshots && (
                                            <div className="tab-pane fade show active">
                                                <Swiper
                                                    spaceBetween={10}
                                                    slidesPerView={3}
                                                    navigation
                                                    pagination={{ clickable: true }}
                                                    loop={true}
                                                    modules={[Navigation]}
                                                >
                                                    {addon.custom_fields.screenshots?.length > 0 ? (
                                                        addon.custom_fields.screenshots.map((image, index) => (
                                                            <SwiperSlide key={index}>
                                                                <img
                                                                    src={image}
                                                                    alt={`Screenshot ${index + 1}`}
                                                                    className="d-block w-100 addon-screenshot"
                                                                    onClick={() => openLightbox(image)}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            </SwiperSlide>
                                                        ))
                                                    ) : (
                                                        <SwiperSlide>
                                                            <img
                                                                src={addon.featured_image}
                                                                alt="Featured Image"
                                                                className="d-block w-100 addon-screenshot"
                                                                onClick={() => openLightbox(addon.featured_image)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </SwiperSlide>
                                                    )}
                                                </Swiper>
                                            </div>
                                        )}
                                        {activeTab === 'developers' && (
                                            <div className="tab-pane fade show active">
                                                <div className="row row-cols-2 p-3 addon-developers">
                                                    <div className="col">
                                                        <h5 className="fw-medium">Owner <Tippy content="The creator of this addon" placement="auto"><i className="bi bi-question-circle ms-1"></i></Tippy></h5>
                                                        {renderOriginalCreator()}
                                                    </div>
                                                    {developers.length > 0 && (
                                                        <div className="col">
                                                            <h5 className="fw-medium">Developers <Tippy content="People that worked on the addon - Team Members, Backporters, etc" placement="top"><i className="bi bi-question-circle ms-1"></i></Tippy></h5>
                                                            {renderAdditionalDevelopers()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer justify-content-center">
                            <button type="button" className="btn btn-secondary btn-secondary-2" onClick={onHide}><i className="bi bi-x-lg"></i> Close Preview</button>
                        </div>
                    </div>
                </div>

                {lightboxOpen && (
                    <div className="lightbox-overlay">
                        <span className="lightbox-close" onClick={closeLightbox}><i className="bi bi-x-lg"></i> Close Images</span>
                        <Swiper
                            spaceBetween={10}
                            slidesPerView={1}
                            navigation
                            loop={true}
                            modules={[Navigation]}
                            initialSlide={currentImage === addon.featured_image ? 0 : addon.custom_fields.screenshots?.indexOf(currentImage) || 0}
                        >
                            {addon.custom_fields.screenshots?.length > 0 ? (
                                addon.custom_fields.screenshots.map((image, index) => (
                                    <SwiperSlide key={index}>
                                        <img src={image} className="lightbox-image" alt={`Screenshot ${index + 1}`} />
                                    </SwiperSlide>
                                ))
                            ) : (
                                <SwiperSlide>
                                    <img src={addon.featured_image} className="lightbox-image" alt="Featured Image" />
                                </SwiperSlide>
                            )}
                        </Swiper>
                    </div>
                )}
            </div>
        </>
    );
};

export default AddonModal;