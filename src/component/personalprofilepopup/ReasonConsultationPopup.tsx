"use client";

import React, { useState, useEffect } from 'react';

interface ReasonConsultationPopupProps {
    options: { id: any; name: string }[];
    selectedIds: any[];
    onApply: (ids: any[]) => void;
}

const ReasonConsultationPopup: React.FC<ReasonConsultationPopupProps> = ({
    options,
    selectedIds,
    onApply,
}) => {
    const [search, setSearch] = useState("");
    const [checkedIds, setCheckedIds] = useState<any[]>([]);

    // Synchronize selectedIds from props when they change
    useEffect(() => {
        setCheckedIds(selectedIds);
    }, [selectedIds]);

    const filteredReasons = options.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleToggle = (id: any) => {
        const idNum = Number(id);
        setCheckedIds((prev) => {
            const hasId = prev.some(x => Number(x) === idNum);
            if (hasId) {
                return prev.filter((item) => Number(item) !== idNum);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleClear = () => {
        setCheckedIds([]);
    };

    const handleApply = () => {
        onApply(checkedIds.map(x => Number(x)).filter(x => !isNaN(x)));
    };

    return (
        <>
            <div className="modal fade" id="reasonConsultation" tabIndex={-1} aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered onyba-spec-bootstrap-dialog">
                    <div className="modal-content onyba-spec-bootstrap-content">

                        <div className="onyba-spec-pop-header-row">
                            <div className="onyba-spec-pop-title-box">
                                <span className="onyba-spec-pop-icon-badge"><img src="images/star-popup-icon.svg" alt="" /></span>
                                <h2>Reason for Consultation</h2>
                            </div>
                            <button type="button" className="onyba-spec-pop-close-btn" data-bs-dismiss="modal" aria-label="Close">
                                <img src="images/close-btn-popup.svg" alt="&times;" />
                            </button>
                        </div>

                        <div className="onyba-spec-pop-main-card">

                            <div className="onyba-spec-pop-accordion-bar"
                                data-bs-toggle="collapse"
                                data-bs-target="#onybaSpecDropdownContent"
                                aria-expanded="true"
                                aria-controls="onybaSpecDropdownContent">
                                <span>Choose diseases which you cure</span>
                                <span className="onyba-spec-pop-arrow"><img src="images/drop-down-icon-s.svg" alt="" /></span>
                            </div>

                            <div className="collapse show" id="onybaSpecDropdownContent">
                                <div className="onyba-spec-pop-dropdown-body">

                                    <div className="onyba-spec-pop-search-wrap">
                                        <span className="onyba-spec-pop-search-icon"><img src="images/search-icon-popup.svg" alt="" /></span>
                                        <input type="text" className="onyba-spec-pop-search-field" placeholder="Search" value={search} onChange={(e)=> setSearch(e.target.value)} />
                                    </div>

                                    <div className="onyba-spec-pop-scroll-stack">
                                        {filteredReasons.map((item) => {
                                            const idNum = Number(item.id);
                                            const isChecked = checkedIds.some(x => Number(x) === idNum);
                                            return (
                                                <label key={item.id} className="onyba-spec-pop-checkbox-row">
                                                    <span>{item.name}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggle(item.id)}
                                                    />
                                                    <span className="onyba-spec-pop-checkmark"></span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <div className="onyba-spec-pop-actions-box">
                                        <button type="button" className="onyba-spec-pop-btn-clear" onClick={handleClear}>Clear</button>
                                        <button type="button" className="onyba-spec-pop-btn-apply" data-bs-dismiss="modal" onClick={handleApply}>Apply</button>
                                    </div>

                                </div>
                            </div>

                        </div>

                    </div>
                </div>
            </div>

        </>
    );
};

export default ReasonConsultationPopup;
