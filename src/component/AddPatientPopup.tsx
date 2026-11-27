"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { requestApi } from "@/src/utils/api";
import Autocomplete from "react-google-autocomplete";

export interface AddPatientPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newPatient?: any, newPatientName?: string) => void;
}

export const getTherapistId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem("loginUser");
    if (stored) {
      const parsed = JSON.parse(stored);
      const id =
        parsed?.therapist_id ||
        parsed?.user?.therapist_id ||
        parsed?.user?.id ||
        parsed?.id ||
        parsed?.user_details?.id ||
        parsed?.user_details?.[0]?.id ||
        parsed?.user_details?.[0]?.therapist_id ||
        parsed?.data?.user?.id ||
        parsed?.data?.therapist_id ||
        parsed?.data?.id;
      if (id) return String(id);
    }
    const profileStored = window.sessionStorage.getItem("therapistProfile");
    if (profileStored) {
      const profile = JSON.parse(profileStored);
      const id =
        profile?.therapist_id ||
        profile?.id ||
        profile?.user_id ||
        profile?.data?.therapist_id ||
        profile?.data?.id;
      if (id) return String(id);
    }
  } catch (e) {
    console.error("Failed to get therapist id:", e);
  }
  return "";
};

const extractAddressComponents = (place: any) => {
  const result = {
    city: "",
    province: "",
    postalCode: "",
    country: "",
  };

  if (!place || !place.address_components) {
    result.city = place?.name || "";
    return result;
  }

  for (const component of place.address_components) {
    const types = component.types;
    if (types.includes("locality")) {
      result.city = component.long_name;
    } else if (types.includes("administrative_area_level_3") && !result.city) {
      result.city = component.long_name;
    } else if (types.includes("sublocality_level_1") && !result.city) {
      result.city = component.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      result.province = component.long_name;
    } else if (types.includes("postal_code")) {
      result.postalCode = component.long_name;
    } else if (types.includes("country")) {
      result.country = component.long_name;
    }
  }

  if (!result.city) {
    result.city = place.name || "";
  }
  return result;
};

interface AddPatientFormData {
  first_name: string;
  last_name: string;
  dni_number: string;
  country_of_origin: string;
  sex: string;
  children: string;
  mobile: string;
  phone: string;
  email: string;
  dob: string;
  age: string;
  marital_status: string;
  occupation: string;
  father_name: string;
  mother_name: string;
  street_number_floor: string;
  city: string;
  province: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  profileImage: File | null;
}

const INITIAL_FORM_DATA: AddPatientFormData = {
  first_name: "",
  last_name: "",
  dni_number: "",
  country_of_origin: "",
  sex: "",
  children: "",
  mobile: "",
  phone: "",
  email: "",
  dob: "",
  age: "",
  marital_status: "",
  occupation: "",
  father_name: "",
  mother_name: "",
  street_number_floor: "",
  city: "",
  province: "",
  postal_code: "",
  latitude: "",
  longitude: "",
  profileImage: null,
};

const AddPatientPopup: React.FC<AddPatientPopupProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<AddPatientFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_FORM_DATA);
      setErrors({});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInput = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if ((name === "mobile" || name === "phone") && errors.mobile) {
      setErrors((prev) => ({ ...prev, mobile: null }));
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files[0]) {
      setFormData((prev) => ({
        ...prev,
        profileImage: files[0],
      }));
    }
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dobVal = e.target.value;
    setFormData((prev) => {
      const updated = { ...prev, dob: dobVal };
      if (dobVal) {
        const birthDate = new Date(dobVal);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            calculatedAge--;
          }
          updated.age = calculatedAge >= 0 ? calculatedAge.toString() : "";
        }
      }
      return updated;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name || !formData.first_name.trim()) {
      newErrors.first_name = "First Name is required.";
    }
    if (!formData.last_name || !formData.last_name.trim()) {
      newErrors.last_name = "Last Name is required.";
    }
    const phoneVal = formData.mobile?.trim() || formData.phone?.trim();
    if (!phoneVal) {
      newErrors.mobile = "Phone number is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      formData.email &&
      formData.email.trim() &&
      !emailRegex.test(formData.email.trim())
    ) {
      newErrors.email = "Invalid email address format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const payload = new FormData();

    payload.append("first_name", formData.first_name.trim());
    payload.append("surname_one", formData.last_name.trim());
    payload.append("doc_number", formData.dni_number.trim());
    payload.append("country_of_origin", formData.country_of_origin.trim());
    payload.append("gender", formData.sex ? formData.sex.toLowerCase() : "");
    payload.append("children", formData.children || "");

    const effectivePhone = formData.mobile.trim() || formData.phone.trim();
    payload.append("phone", effectivePhone);
    payload.append("alternate_phone", formData.phone.trim());

    payload.append("email", formData.email.trim());
    payload.append("dob", formData.dob || "");
    payload.append("age", formData.age || "");
    payload.append(
      "marital_status",
      formData.marital_status ? formData.marital_status.toLowerCase() : ""
    );
    payload.append("occupation", formData.occupation.trim());
    payload.append("father_name", formData.father_name.trim());
    payload.append("mother_name", formData.mother_name.trim());
    payload.append("street_number_floor", formData.street_number_floor.trim());
    payload.append("city", formData.city || "");
    payload.append("province", formData.province || "");
    payload.append("postal_code", formData.postal_code || "");
    payload.append("latitude", formData.latitude || "");
    payload.append("longitude", formData.longitude || "");

    const therapistId = getTherapistId();
    if (therapistId) {
      payload.append("therapist_id", therapistId);
    }

    if (formData.profileImage) {
      payload.append("profile_image", formData.profileImage);
    }

    try {
      const response = await requestApi({
        endpoint: "/add-new-patient",
        method: "POST",
        data: payload,
        isFormData: true,
      });

      if (response && response.success) {
        toast.success(response.message || "Patient added successfully!");
        if (onSuccess) {
          onSuccess(
            response.data,
            `${formData.first_name.trim()} ${formData.last_name.trim()}`
          );
        }
        onClose();
      } else {
        toast.error(response?.message || "Failed to add patient");
      }
    } catch (err: any) {
      console.error("Failed to add patient:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "An error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="modal show d-block"
        tabIndex={-1}
        role="dialog"
        style={{
          zIndex: 1060,
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          overflowY: "auto",
        }}
      >
        <div
          className="modal-dialog modal-dialog-centered"
          style={{ maxWidth: "980px", width: "95%", margin: "30px auto" }}
        >
          <div
            className="modal-content"
            style={{
              borderRadius: "28px",
              border: "none",
              padding: "36px 40px 40px 40px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
              position: "relative",
              background: "#ffffff",
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "24px",
                right: "24px",
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                border: "1px solid #dcdcdc",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                color: "#6c757d",
                transition: "opacity 0.2s",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: 600,
                  color: "#2d2526",
                  margin: 0,
                  letterSpacing: "-0.3px",
                }}
              >
                Add Patient
              </h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Profile Image Section */}
              <div style={{ marginBottom: "26px" }}>
                <label className="acp-field-label">Profile Image</label>
                <div className="acp-upload-flex-box">
                  <input
                    type="file"
                    id="popupPatientPhoto"
                    name="profileImage"
                    onChange={handleFile}
                    accept="image/*"
                    className="acp-hidden-file-input"
                    style={{ display: "none" }}
                  />

                  <div
                    className="acp-avatar-circle"
                    onClick={() =>
                      document.getElementById("popupPatientPhoto")?.click()
                    }
                    style={{
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {formData.profileImage ? (
                      <img
                        src={
                          typeof formData.profileImage === "string"
                            ? formData.profileImage
                            : URL.createObjectURL(formData.profileImage)
                        }
                        alt="Profile Preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        style={{ width: "22px", height: "22px" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                      </svg>
                    )}
                  </div>

                  <button
                    type="button"
                    className="acp-photo-upload-btn"
                    onClick={() =>
                      document.getElementById("popupPatientPhoto")?.click()
                    }
                  >
                    Upload Photo
                  </button>
                </div>
              </div>

              {/* Row 1: First Name*, Last Name*, DNI Number */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "18px",
                  marginBottom: "20px",
                }}
              >
                <div className="acp-input-group">
                  <label className="acp-field-label">First Name*</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInput}
                    placeholder="Enter your first name"
                    className="acp-form-input-field"
                    required
                  />
                  {errors.first_name && (
                    <div
                      style={{
                        color: "#e53935",
                        fontSize: "13px",
                        marginTop: "5px",
                      }}
                    >
                      {errors.first_name}
                    </div>
                  )}
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Last Name*</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInput}
                    placeholder="Enter your last name"
                    className="acp-form-input-field"
                    required
                  />
                  {errors.last_name && (
                    <div
                      style={{
                        color: "#e53935",
                        fontSize: "13px",
                        marginTop: "5px",
                      }}
                    >
                      {errors.last_name}
                    </div>
                  )}
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">DNI Number</label>
                  <input
                    type="text"
                    name="dni_number"
                    value={formData.dni_number}
                    onChange={handleInput}
                    placeholder="Y9250199G"
                    className="acp-form-input-field"
                  />
                </div>
              </div>

              {/* Row 2: Country of Origin, Sex, Children?, Mobile* */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "18px",
                  marginBottom: "20px",
                }}
              >
                <div className="acp-input-group">
                  <label className="acp-field-label">Country of Origin</label>
                  <div style={{ position: "relative" }}>
                    <select
                      name="country_of_origin"
                      value={formData.country_of_origin}
                      onChange={handleInput}
                      className="acp-form-input-field"
                    >
                      <option value="">Country</option>
                      <option value="Spain">Spain</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="France">France</option>
                      <option value="Germany">Germany</option>
                      <option value="Italy">Italy</option>
                      <option value="Portugal">Portugal</option>
                      <option value="Argentina">Argentina</option>
                      <option value="Colombia">Colombia</option>
                      <option value="Mexico">Mexico</option>
                      <option value="Chile">Chile</option>
                      <option value="Peru">Peru</option>
                      <option value="Ecuador">Ecuador</option>
                      <option value="Canada">Canada</option>
                      <option value="Other">Other</option>
                    </select>
                    <div
                      className="acp-select-custom-arrow"
                      style={{
                        position: "absolute",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        style={{ width: "16px", height: "16px" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Sex</label>
                  <div style={{ position: "relative" }}>
                    <select
                      name="sex"
                      value={formData.sex}
                      onChange={handleInput}
                      className="acp-form-input-field"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <div
                      className="acp-select-custom-arrow"
                      style={{
                        position: "absolute",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        style={{ width: "16px", height: "16px" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Children?</label>
                  <div style={{ position: "relative" }}>
                    <select
                      name="children"
                      value={formData.children}
                      onChange={handleInput}
                      className="acp-form-input-field"
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    <div
                      className="acp-select-custom-arrow"
                      style={{
                        position: "absolute",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        style={{ width: "16px", height: "16px" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Phone Number*</label>
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleInput}
                    placeholder="+34 661008179"
                    className="acp-form-input-field"
                  />
                  {errors.mobile && (
                    <div
                      style={{
                        color: "#e53935",
                        fontSize: "13px",
                        marginTop: "5px",
                      }}
                    >
                      {errors.mobile}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Phone, E-mail, Date of Birth, Age */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "18px",
                  marginBottom: "20px",
                }}
              >
                <div className="acp-input-group">
                  <label className="acp-field-label">Alternate Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInput}
                    placeholder="+34 000000000"
                    className="acp-form-input-field"
                  />
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInput}
                    placeholder="alexandra203iba@gmail.com"
                    className="acp-form-input-field"
                  />
                  {errors.email && (
                    <div
                      style={{
                        color: "#e53935",
                        fontSize: "13px",
                        marginTop: "5px",
                      }}
                    >
                      {errors.email}
                    </div>
                  )}
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleDobChange}
                    className="acp-form-input-field"
                  />
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInput}
                    placeholder="20"
                    className="acp-form-input-field"
                  />
                </div>
              </div>

              {/* Row 4: Marital Status, Occupation, Father's Name, Mother's Name */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "18px",
                  marginBottom: "20px",
                }}
              >
                <div className="acp-input-group">
                  <label className="acp-field-label">Marital Status</label>
                  <div style={{ position: "relative" }}>
                    <select
                      name="marital_status"
                      value={formData.marital_status}
                      onChange={handleInput}
                      className="acp-form-input-field"
                    >
                      <option value="">Select</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                    <div
                      className="acp-select-custom-arrow"
                      style={{
                        position: "absolute",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        style={{ width: "16px", height: "16px" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Occupation</label>
                  <input
                    type="text"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleInput}
                    placeholder="student"
                    className="acp-form-input-field"
                  />
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Father's Name</label>
                  <input
                    type="text"
                    name="father_name"
                    value={formData.father_name}
                    onChange={handleInput}
                    placeholder="John"
                    className="acp-form-input-field"
                  />
                </div>

                <div className="acp-input-group">
                  <label className="acp-field-label">Mother's Name</label>
                  <input
                    type="text"
                    name="mother_name"
                    value={formData.mother_name}
                    onChange={handleInput}
                    placeholder="Cena"
                    className="acp-form-input-field"
                  />
                </div>
              </div>

              {/* Row 5: Address (Street with Google Autocomplete) */}
              <div style={{ marginBottom: "32px" }}>
                <div className="acp-input-group">
                  <label className="acp-field-label">Address</label>
                  <Autocomplete
                    apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                    onPlaceSelected={(place: any) => {
                      const extracted = extractAddressComponents(place);
                      const streetName =
                        place.formatted_address || place.name || "";
                      const lat = place.geometry?.location?.lat
                        ? place.geometry.location.lat()
                        : "";
                      const lng = place.geometry?.location?.lng
                        ? place.geometry.location.lng()
                        : "";

                      setFormData((prev) => ({
                        ...prev,
                        street_number_floor: streetName,
                        city: extracted.city || prev.city,
                        province: extracted.province || prev.province,
                        postal_code: extracted.postalCode || prev.postal_code,
                        country_of_origin:
                          prev.country_of_origin || extracted.country,
                        latitude: lat ? String(lat) : prev.latitude,
                        longitude: lng ? String(lng) : prev.longitude,
                      }));
                    }}
                    options={{
                      types: ["address"],
                    }}
                    className="acp-form-input-field"
                    placeholder="4517 Washington"
                    name="street_number_floor"
                    value={formData.street_number_floor}
                    onChange={(e: any) => {
                      const val = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        street_number_floor: val,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Action Button: Add Patient */}
              <div>
                <button
                  type="submit"
                  className="acp-main-submit-btn"
                  disabled={isSubmitting}
                  style={{
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "Adding Patient..." : "Add Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddPatientPopup;
