"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { requestApi } from '@/src/utils/api';
import Autocomplete from "react-google-autocomplete";

const getCountryName = (place: any) => {
  if (!place || !place.address_components) return place?.name || "";
  for (const component of place.address_components) {
    if (component.types.includes("country")) {
      return component.long_name;
    }
  }
  return place.name || "";
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
  surname_one: string;
  surname_two: string;
  gender: string;
  phone: string;
  doc_country: string;
  doc_type: string;
  doc_number: string;
  alternate_phone: string;
  email: string;
  dob: string;
  age: string;
  marital_status: string;
  occupation: string;
  reason_for_consultation: string;
  info_source: string;
  street_number_floor: string;
  city: string;
  province: string;
  country: string;
  company?: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  father_name: string;
  father_surname_one: string;
  father_surname_two: string;
  father_dni_number: string;
  father_phone_number: string;
  father_email: string;
  mother_name: string;
  mother_surname_one: string;
  mother_surname_two: string;
  mother_dni_number: string;
  mother_phone_number: string;
  mother_email: string;
  registrationDate: string;
  profileImage: File | null;
  therapy_type: string;
  partner_first_name?: string;
  partner_surname_one?: string;
  partner_surname_two?: string;
  partner_doc_type?: string;
  partner_doc_number?: string;
  partner_phone?: string;
  partner_email?: string;
}

const AddClinicPatient = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<AddPatientFormData>({
    first_name: "",
    surname_one: "",
    surname_two: "",
    gender: "",
    phone: "",
    doc_country: "Spain",
    doc_type: "dni",
    doc_number: "",
    alternate_phone: "",
    email: "",
    dob: "",
    age: "",
    marital_status: "single",
    occupation: "",
    reason_for_consultation: "",
    info_source: "",
    street_number_floor: "",
    city: "",
    province: "",
    country: "Spain",
    company: "",
    postal_code: "",
    latitude: "",
    longitude: "",
    father_name: "",
    father_surname_one: "",
    father_surname_two: "",
    father_dni_number: "",
    father_phone_number: "",
    father_email: "",
    mother_name: "",
    mother_surname_one: "",
    mother_surname_two: "",
    mother_dni_number: "",
    mother_phone_number: "",
    mother_email: "",
    registrationDate: "02/03/2026",
    profileImage: null,
    therapy_type: "Adult",
    partner_first_name: "",
    partner_surname_one: "",
    partner_surname_two: "",
    partner_doc_type: "dni",
    partner_doc_number: "",
    partner_phone: "",
    partner_email: "",
  });

  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: AddPatientFormData) => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dobVal = e.target.value;
    setFormData((prev: AddPatientFormData) => {
      const updated = { ...prev, dob: dobVal };
      if (dobVal) {
        const birthDate = new Date(dobVal);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          updated.age = calculatedAge >= 0 ? calculatedAge.toString() : "";
        }
      }
      return updated;
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;

    if (files && files[0]) {
      setFormData((prev: AddPatientFormData) => ({
        ...prev,
        [name]: files[0]
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name || !formData.first_name.trim()) {
      newErrors.first_name = "First Name is required";
    }
    if (!formData.surname_one || !formData.surname_one.trim()) {
      newErrors.surname_one = "Surname 1 is required";
    }
    if (!formData.gender) {
      newErrors.gender = "Gender is required";
    }
    if (!formData.doc_type) {
      newErrors.doc_type = "Document Type is required";
    }
    if (!formData.doc_number || !formData.doc_number.trim()) {
      newErrors.doc_number = "Document Number is required";
    }
    if (!formData.phone || !formData.phone.trim()) {
      newErrors.phone = "Phone is required";
    }
    if (!formData.age || !formData.age.trim()) {
      newErrors.age = "Age is required";
    }
    if (!formData.therapy_type) {
      newErrors.therapy_type = "Therapy Type is required";
    }
    if (!formData.street_number_floor || !formData.street_number_floor.trim()) {
      newErrors.street_number_floor = "Street address is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      newErrors.email = "Invalid email address format";
    }

    const patientAge = Number(formData.age);

    if (!isNaN(patientAge) && patientAge < 16) {
      if (!formData.father_name || !formData.father_name.trim()) {
        newErrors.father_name = "Father Name is required for minors";
      }
      if (!formData.father_surname_one || !formData.father_surname_one.trim()) {
        newErrors.father_surname_one = "Father Surname 1 is required for minors";
      }
      if (!formData.father_dni_number || !formData.father_dni_number.trim()) {
        newErrors.father_dni_number = "Father DNI Number is required for minors";
      }
      if (!formData.father_phone_number || !formData.father_phone_number.trim()) {
        newErrors.father_phone_number = "Father Phone Number is required for minors";
      }
      if (!formData.father_email || !formData.father_email.trim()) {
        newErrors.father_email = "Father Email is required for minors";
      } else if (!emailRegex.test(formData.father_email.trim())) {
        newErrors.father_email = "Invalid Father email format";
      }

      if (!formData.mother_name || !formData.mother_name.trim()) {
        newErrors.mother_name = "Mother Name is required for minors";
      }
      if (!formData.mother_surname_one || !formData.mother_surname_one.trim()) {
        newErrors.mother_surname_one = "Mother Surname 1 is required for minors";
      }
      if (!formData.mother_dni_number || !formData.mother_dni_number.trim()) {
        newErrors.mother_dni_number = "Mother DNI Number is required for minors";
      }
      if (!formData.mother_phone_number || !formData.mother_phone_number.trim()) {
        newErrors.mother_phone_number = "Mother Phone Number is required for minors";
      }
      if (!formData.mother_email || !formData.mother_email.trim()) {
        newErrors.mother_email = "Mother Email is required for minors";
      } else if (!emailRegex.test(formData.mother_email.trim())) {
        newErrors.mother_email = "Invalid Mother email format";
      }
    }

    if (formData.therapy_type === 'Couple') {
      if (!formData.partner_first_name || !formData.partner_first_name.trim()) {
        newErrors.partner_first_name = "Partner First Name is required";
      }
      if (!formData.partner_surname_one || !formData.partner_surname_one.trim()) {
        newErrors.partner_surname_one = "Partner Surname 1 is required";
      }
      if (!formData.partner_doc_number || !formData.partner_doc_number.trim()) {
        newErrors.partner_doc_number = "Partner Document Number is required";
      }
      if (formData.partner_email && formData.partner_email.trim() && !emailRegex.test(formData.partner_email.trim())) {
        newErrors.partner_email = "Invalid Partner email format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const patientAge = Number(formData.age);

    // 3. Construct FormData payload
    setIsSubmitting(true);
    const payload = new FormData();

    // Loop and append to FormData
    Object.keys(formData).forEach((key) => {
      // Exclude front-end specific UI helper keys and empty files
      if (key === 'registrationDate' || key === 'profileImage') {
        return;
      }

      // If patient is >= 16, ignore parent-related fields in submission
      if (patientAge >= 16 && (key.startsWith('father_') || key.startsWith('mother_'))) {
        return;
      }

      // If therapy type is not Couple, ignore partner-related fields in submission
      if (formData.therapy_type !== 'Couple' && key.startsWith('partner_')) {
        return;
      }

      payload.append(key, formData[key as keyof AddPatientFormData] as string);
    });

    // Append profile_image file if uploaded
    if (formData.profileImage) {
      payload.append('profile_image', formData.profileImage);
    }

    // Print form data body in console
    const bodyObj: Record<string, any> = {};
    payload.forEach((value, key) => {
      let itemValue: any = value;
      if (value instanceof File) {
        itemValue = {
          name: value.name,
          size: value.size,
          type: value.type,
        };
      }
      if (Object.prototype.hasOwnProperty.call(bodyObj, key)) {
        if (Array.isArray(bodyObj[key])) {
          bodyObj[key].push(itemValue);
        } else {
          bodyObj[key] = [bodyObj[key], itemValue];
        }
      } else {
        bodyObj[key] = itemValue;
      }
    });

    console.log("add-clinic-patient Request Body / Payload Object:", bodyObj);
    console.log("add-clinic-patient Request Body (JSON):", JSON.stringify(bodyObj, null, 2));

    try {
      const response = await requestApi({
        endpoint: 'add-clinic-patient',
        method: 'POST',
        data: payload,
        isFormData: true
      });

      if (response && response.success) {
        toast.success(response.message || "Patient added successfully!");
        router.push('/clinic-patients');
      } else {
        toast.error(response.message || "Failed to add patient");
      }
    } catch (err: unknown) {
      console.error("Failed to add patient:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = error.response?.data?.message || error.message || "An error occurred. Please try again.";
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="gl-content-body">
        <div className="acp-wrapper acp-main-container">

          <div className="acp-header-area">
            <div className="acp-title-flex">
              <Link href="/clinic-patients" className="acp-back-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "19px", height: "19px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </Link>
              <h1 className="acp-main-title">Add Clinic Patient</h1>
            </div>
            <p className="acp-subtitle-text">Please add patient details</p>
          </div>

          <div className="acp-section-heading">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" style={{ width: "20px", height: "20px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span>Patient Details</span>
          </div>

          <form onSubmit={addPatient} noValidate>

            <div className="acp-top-meta-row">
              <div>
                <label className="acp-field-label">Profile Image</label>
                <div className="acp-upload-flex-box">

                  <input
                    type="file"
                    id="acpPatientPhoto"
                    name="profileImage"
                    onChange={handleFile}
                    accept="image/*"
                    className="acp-hidden-file-input"
                  />

                  <div
                    className="acp-avatar-circle"
                    onClick={() => document.getElementById('acpPatientPhoto')?.click()}
                    style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {formData.profileImage ? (
                      <img
                        src={typeof formData.profileImage === 'string' ? formData.profileImage : URL.createObjectURL(formData.profileImage)}
                        alt="Profile Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: "24px", height: "24px" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                    )}
                  </div>

                  <button
                    type="button"
                    className="acp-photo-upload-btn"
                    onClick={() => document.getElementById('acpPatientPhoto')?.click()}
                  >
                    Upload Photo
                  </button>

                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div className="acp-reg-date-box">
                  <span className="acp-field-label" style={{ marginBottom: "0" }}>History Number</span>
                  <input type="text" value="Auto-generated" className="acp-form-input-field acp-reg-date-input" style={{ backgroundColor: '#f5f9f6', color: '#68404c', fontWeight: 600 }} readOnly />
                </div>
                <div className="acp-reg-date-box">
                  <span className="acp-field-label" style={{ marginBottom: "0" }}>Patient Type</span>
                  <input type="text" value="Clinic Patient" className="acp-form-input-field acp-reg-date-input" style={{ backgroundColor: '#f5f9f6', color: '#68404c', fontWeight: 600 }} readOnly />
                </div>
                <div className="acp-reg-date-box">
                  <span className="acp-field-label" style={{ marginBottom: "0" }}>Registration Date</span>
                  <input type="text" value={formData?.registrationDate} onChange={handleInput} name='registrationDate' className="acp-form-input-field acp-reg-date-input" readOnly />
                </div>
              </div>
            </div>

            <div className="acp-grid-row acp-grid-4cols">
              <div className="acp-input-group">
                <label className="acp-field-label">First Name*</label>
                <input type="text" value={formData?.first_name || ""} onChange={handleInput} placeholder="Enter first name" name='first_name' className="acp-form-input-field" required />
                {errors.first_name && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.first_name}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Surname 1*</label>
                <input type="text" value={formData?.surname_one || ""} onChange={handleInput} placeholder="Enter surname 1" name='surname_one' className="acp-form-input-field" required />
                {errors.surname_one && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.surname_one}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Surname 2(Optional)</label>
                <input type="text" value={formData?.surname_two || ""} onChange={handleInput} placeholder="Enter surname 2" name='surname_two' className="acp-form-input-field" />
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Gender*</label>
                <select value={formData?.gender || ""} onChange={handleInput} name='gender' className="acp-form-input-field" required>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.gender}</div>}
              </div>
            </div>

            <div className="acp-grid-row acp-grid-5cols">
              <div className="acp-input-group">
                <label className="acp-field-label">Document Type*</label>
                <select value={formData?.doc_type || ""} onChange={handleInput} name='doc_type' className="acp-form-input-field" required>
                  <option value="dni">DNI</option>
                  <option value="passport">Passport</option>
                  <option value="nie">NIE</option>
                  <option value="other">Other</option>
                </select>
                <div className="acp-select-custom-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
                {errors.doc_type && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.doc_type}</div>}
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">Document Number*</label>
                <input type="text" value={formData?.doc_number || ""} onChange={handleInput} placeholder="Enter document number" name='doc_number' className="acp-form-input-field" required />
                {errors.doc_number && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.doc_number}</div>}
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">Country</label>
                <Autocomplete
                  apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                  onPlaceSelected={(place) => {
                    const countryName = getCountryName(place);
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      doc_country: countryName,
                    }));
                    if (errors.doc_country)
                      setErrors((prev) => ({ ...prev, doc_country: null }));
                  }}
                  options={{
                    types: ["country"],
                  }}
                  className="acp-form-input-field"
                  placeholder="Enter document country"
                  name="doc_country"
                  value={formData?.doc_country || ""}
                  onChange={(e: any) => {
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      doc_country: e.target.value,
                    }));
                    if (errors.doc_country)
                      setErrors((prev) => ({ ...prev, doc_country: null }));
                  }}
                />
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">Phone*</label>
                <input type="text" value={formData?.phone || ""} onChange={handleInput} placeholder="Enter phone number" name='phone' className="acp-form-input-field" required />
                {errors.phone && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.phone}</div>}
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">Alternate Number(Optional)</label>
                <input type="text" value={formData?.alternate_phone || ""} onChange={handleInput} placeholder="Enter alternate phone" name='alternate_phone' className="acp-form-input-field" />
              </div>
            </div>

            <div className="acp-grid-row acp-grid-5cols">
              <div className="acp-input-group">
                <label className="acp-field-label">E-mail</label>
                <input type="email" value={formData?.email || ""} onChange={handleInput} placeholder="Enter email" name='email' className="acp-form-input-field" />
                {errors.email && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.email}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Date of birth</label>
                <input type="date" value={formData?.dob || ""} onChange={handleDobChange} name='dob' className="acp-form-input-field" />
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Age*</label>
                <input type="number" value={formData?.age || ""} onChange={handleInput} placeholder="Enter age" name='age' className="acp-form-input-field" required />
                {errors.age && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.age}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Marital Status</label>
                <select value={formData?.marital_status || "single"} onChange={handleInput} name='marital_status' className="acp-form-input-field">
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
                <div className="acp-select-custom-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Therapy Type*</label>
                <select value={formData?.therapy_type || "Adult"} onChange={handleInput} name='therapy_type' className="acp-form-input-field" required>
                  <option value="Adult">Adult</option>
                  <option value="Couple">Couple</option>
                  <option value="Child">Child</option>
                  <option value="Family">Family</option>
                  <option value="Coaching">Coaching</option>
                </select>
                <div className="acp-select-custom-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
                {errors.therapy_type && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.therapy_type}</div>}
              </div>
            </div>

            <div className="acp-grid-row acp-grid-2cols">
              <div className="acp-input-group">
                <label className="acp-field-label">Occupation</label>
                <input type="text" value={formData?.occupation || ""} onChange={handleInput} placeholder="Enter occupation" name='occupation' className="acp-form-input-field" />
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">How did you know us</label>
                <input type="text" value={formData?.info_source || ""} onChange={handleInput} placeholder="How did you know us" name='info_source' className="acp-form-input-field" />
              </div>
            </div>

            <div className="acp-grid-row acp-grid-cols">
              <div className="acp-input-group">
                <label className="acp-field-label">Reason for Consultation</label>
                <input type="text" value={formData?.reason_for_consultation || ""} onChange={handleInput} placeholder="Enter reason for consultation" name='reason_for_consultation' className="acp-form-input-field" />
              </div>
            </div>

            <div className="acp-grid-row acp-grid-5cols">
              <div className="acp-input-group">
                <label className="acp-field-label">Street-number-floor*</label>
                <Autocomplete
                  apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                  onPlaceSelected={(place) => {
                    const extracted = extractAddressComponents(place);
                    const streetName = place.formatted_address || place.name || "";
                    const lat = place.geometry?.location?.lat();
                    const lng = place.geometry?.location?.lng();
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      street_number_floor: streetName,
                      city: extracted.city || prev.city,
                      province: extracted.province || prev.province,
                      postal_code: extracted.postalCode || prev.postal_code,
                      country: extracted.country || prev.country,
                      latitude: lat ? String(lat) : prev.latitude,
                      longitude: lng ? String(lng) : prev.longitude,
                    }));
                    if (errors.street_number_floor)
                      setErrors((prev) => ({ ...prev, street_number_floor: null }));
                  }}
                  options={{
                    types: ["address"],
                  }}
                  className="acp-form-input-field"
                  placeholder="Enter street/number/floor"
                  name="street_number_floor"
                  value={formData?.street_number_floor || ""}
                  onChange={(e: any) => {
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      street_number_floor: e.target.value,
                    }));
                    if (errors.street_number_floor)
                      setErrors((prev) => ({ ...prev, street_number_floor: null }));
                  }}
                  required
                />
                {errors.street_number_floor && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.street_number_floor}</div>}
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">City</label>
                <Autocomplete
                  apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                  onPlaceSelected={(place) => {
                    const extracted = extractAddressComponents(place);
                    const lat = place.geometry?.location?.lat();
                    const lng = place.geometry?.location?.lng();
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      city: extracted.city || prev.city,
                      province: extracted.province || prev.province,
                      postal_code: extracted.postalCode || prev.postal_code,
                      country: extracted.country || prev.country,
                      latitude: lat ? String(lat) : prev.latitude,
                      longitude: lng ? String(lng) : prev.longitude,
                    }));
                    if (errors.city)
                      setErrors((prev) => ({ ...prev, city: null }));
                  }}
                  options={{
                    types: ["(cities)"],
                  }}
                  className="acp-form-input-field"
                  placeholder="Enter city"
                  name="city"
                  value={formData?.city || ""}
                  onChange={(e: any) => {
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      city: e.target.value,
                    }));
                    if (errors.city)
                      setErrors((prev) => ({ ...prev, city: null }));
                  }}
                />
                {errors.city && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.city}</div>}
              </div>

              <div className="acp-input-group">
                <label className="acp-field-label">Postal Code</label>
                <input type="text" value={formData?.postal_code || ""} onChange={handleInput} placeholder="Enter postal code" name="postal_code" className="acp-form-input-field" />
                {errors.postal_code && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.postal_code}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Province</label>
                <input type="text" value={formData?.province || ""} onChange={handleInput} placeholder="Enter province" name="province" className="acp-form-input-field" />
                {errors.province && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.province}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">Country</label>
                <Autocomplete
                  apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                  onPlaceSelected={(place) => {
                    const countryName = getCountryName(place);
                    const lat = place.geometry?.location?.lat();
                    const lng = place.geometry?.location?.lng();
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      country: countryName,
                      latitude: lat ? String(lat) : prev.latitude,
                      longitude: lng ? String(lng) : prev.longitude,
                    }));
                    if (errors.country)
                      setErrors((prev) => ({ ...prev, country: null }));
                  }}
                  options={{
                    types: ["country"],
                  }}
                  className="acp-form-input-field"
                  placeholder="Enter country"
                  name="country"
                  value={formData?.country || ""}
                  onChange={(e: any) => {
                    setFormData((prev: AddPatientFormData) => ({
                      ...prev,
                      country: e.target.value,
                    }));
                    if (errors.country)
                      setErrors((prev) => ({ ...prev, country: null }));
                  }}
                />
                {errors.country && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.country}</div>}
              </div>
              <div className="acp-input-group">
                <label className="acp-field-label">insurance</label>
                <input type="text" value={formData?.company || ""} onChange={handleInput} name="company" className="acp-form-input-field" />
              </div>
            </div>

            {formData.age !== "" && Number(formData.age) < 16 && (
              <>
                <hr style={{ margin: "40px 0 40px 0", color: "#ccc" }} />
                
                <div style={{ marginBottom: "25px" }}>
                  <span style={{ backgroundColor: "#EAE5E7", padding: "15px", borderRadius: "50px", fontSize: "14px" }}>
                    <img src="/images/info-icn.png" alt="" style={{ marginRight: "8px" }} /> If patient age under 16 we need parents details
                  </span>
                </div>

                <div className="acp-grid-row acp-grid-4cols">
                  <div className="acp-input-group">
                    <label className="acp-field-label">Father Name*</label>
                    <input type="text" value={formData?.father_name || ""} onChange={handleInput} placeholder="Enter Father name" name="father_name" className="acp-form-input-field" required />
                    {errors.father_name && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.father_name}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Surname 1*</label>
                    <input type="text" value={formData?.father_surname_one || ""} onChange={handleInput} placeholder="Enter surname 1" name="father_surname_one" className="acp-form-input-field" required />
                    {errors.father_surname_one && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.father_surname_one}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Surname 2(Optional)</label>
                    <input type="text" value={formData?.father_surname_two || ""} onChange={handleInput} placeholder="Enter surname 2" name="father_surname_two" className="acp-form-input-field" />
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">DNI Number*</label>
                    <input type="text" value={formData?.father_dni_number || ""} onChange={handleInput} placeholder="Enter DNI number" name="father_dni_number" className="acp-form-input-field" required />
                    {errors.father_dni_number && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.father_dni_number}</div>}
                  </div>
                </div>

                <div className="acp-grid-row acp-grid-2cols">
                  <div className="acp-input-group">
                    <label className="acp-field-label">Phone Number*</label>
                    <input type="text" value={formData?.father_phone_number || ""} onChange={handleInput} placeholder="Enter phone number" name="father_phone_number" className="acp-form-input-field" required />
                    {errors.father_phone_number && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.father_phone_number}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Email*</label>
                    <input type="email" value={formData?.father_email || ""} onChange={handleInput} placeholder="Enter email" name="father_email" className="acp-form-input-field" required />
                    {errors.father_email && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.father_email}</div>}
                  </div>
                </div>

                <div className="acp-grid-row acp-grid-4cols" style={{ marginTop: "20px" }}>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Mother Name*</label>
                    <input type="text" value={formData?.mother_name || ""} onChange={handleInput} placeholder="Enter mother name" name="mother_name" className="acp-form-input-field" required />
                    {errors.mother_name && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.mother_name}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Surname 1*</label>
                    <input type="text" value={formData?.mother_surname_one || ""} onChange={handleInput} placeholder="Enter surname 1" name="mother_surname_one" className="acp-form-input-field" required />
                    {errors.mother_surname_one && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.mother_surname_one}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Surname 2(Optional)</label>
                    <input type="text" value={formData?.mother_surname_two || ""} onChange={handleInput} placeholder="Enter surname 2" name="mother_surname_two" className="acp-form-input-field" />
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">DNI Number*</label>
                    <input type="text" value={formData?.mother_dni_number || ""} onChange={handleInput} placeholder="Enter DNI number" name="mother_dni_number" className="acp-form-input-field" required />
                    {errors.mother_dni_number && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.mother_dni_number}</div>}
                  </div>
                </div>

                <div className="acp-grid-row acp-grid-2cols">
                  <div className="acp-input-group">
                    <label className="acp-field-label">Phone Number*</label>
                    <input type="text" value={formData?.mother_phone_number || ""} onChange={handleInput} placeholder="Enter phone number" name="mother_phone_number" className="acp-form-input-field" required />
                    {errors.mother_phone_number && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.mother_phone_number}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Email*</label>
                    <input type="email" value={formData?.mother_email || ""} onChange={handleInput} placeholder="Enter email" name="mother_email" className="acp-form-input-field" required />
                    {errors.mother_email && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.mother_email}</div>}
                  </div>
                </div>
              </>
            )}

            {formData.therapy_type === "Couple" && (
              <>
                <hr style={{ margin: "40px 0 40px 0", color: "#ccc" }} />
                
                <div className="acp-section-heading">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" style={{ width: "20px", height: "20px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 20M3 11.627a1 1 0 0 1-1-1v-.353a1 1 0 0 1 1-1H5M3 11.627v.089c0 1.258.337 2.437.925 3.456M3 11.627A11.4 11.4 0 0 0 10.089 13m0 7c-.029-.328-.047-.66-.051-1.026v-5.948c0-.008 0-.014-.001-.026M10.089 20c.057-.109.117-.216.18-.322m-7.344-4.72c-.08-.182-.152-.37-.214-.565M10.089 13c1.785 0 3.41.677 4.625 1.786m-4.625-1.786a11.43 11.43 0 0 0-6.164 1.786" />
                  </svg>
                  <span>Partner Details (Couple Therapy)</span>
                </div>

                <div className="acp-grid-row acp-grid-4cols">
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner First Name*</label>
                    <input type="text" value={formData?.partner_first_name || ""} onChange={handleInput} placeholder="Enter first name" name="partner_first_name" className="acp-form-input-field" required />
                    {errors.partner_first_name && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.partner_first_name}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner Surname 1*</label>
                    <input type="text" value={formData?.partner_surname_one || ""} onChange={handleInput} placeholder="Enter surname 1" name="partner_surname_one" className="acp-form-input-field" required />
                    {errors.partner_surname_one && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.partner_surname_one}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner Surname 2 (Optional)</label>
                    <input type="text" value={formData?.partner_surname_two || ""} onChange={handleInput} placeholder="Enter surname 2" name="partner_surname_two" className="acp-form-input-field" />
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner Doc. Type*</label>
                    <select value={formData?.partner_doc_type || "dni"} onChange={handleInput} name='partner_doc_type' className="acp-form-input-field" required>
                      <option value="dni">DNI</option>
                      <option value="passport">Passport</option>
                      <option value="nie">NIE</option>
                      <option value="other">Other</option>
                    </select>
                    <div className="acp-select-custom-arrow">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "16px", height: "16px" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="acp-grid-row acp-grid-3cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner Doc. Number*</label>
                    <input type="text" value={formData?.partner_doc_number || ""} onChange={handleInput} placeholder="Enter document number" name="partner_doc_number" className="acp-form-input-field" required />
                    {errors.partner_doc_number && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.partner_doc_number}</div>}
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner Phone (Optional)</label>
                    <input type="text" value={formData?.partner_phone || ""} onChange={handleInput} placeholder="Enter phone number" name="partner_phone" className="acp-form-input-field" />
                  </div>
                  <div className="acp-input-group">
                    <label className="acp-field-label">Partner Email (Optional)</label>
                    <input type="email" value={formData?.partner_email || ""} onChange={handleInput} placeholder="Enter email" name="partner_email" className="acp-form-input-field" />
                    {errors.partner_email && <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>{errors.partner_email}</div>}
                  </div>
                </div>
              </>
            )}

            <div className="acp-submit-action-area">
              <button type="submit" className="acp-main-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>

          </form>
        </div>
      </main>
    </>
  );
};

export default AddClinicPatient;
