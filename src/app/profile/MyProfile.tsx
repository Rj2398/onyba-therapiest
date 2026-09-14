"use client";

import ProfileApproved from "@/src/component/createprofilepopups/ProfileApproved";
import ProfileRejected from "@/src/component/createprofilepopups/ProfileRejected";
import ProfileUnderReviewPopup from "@/src/component/createprofilepopups/ProfileUnderReviewPopup";
import SubmitProfile from "@/src/component/createprofilepopups/SubmitProfile";
import OtpVerificationPopup from "@/src/component/createprofilepopups/OtpVerificationPopup";
import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "@/src/app/UserProvider";
import { useRouter } from "next/navigation";
import { requestApi } from "@/src/utils/api";
import toast from "react-hot-toast";
import Autocomplete from "react-google-autocomplete";
import { Base_image_url } from "@/src/config";

const documentOptions = ["DNI", "NIE", "RESIDENCE_PERMIT", "PASSPORT"];
const cityOptions = ["New York", "Los Angeles", "Chicago"];
const provinceOptions = ["New York", "California", "Illinois"];
const countryOptions = ["United States", "Canada", "United Kingdom"];
// const therapyOptions = ['Adult', 'Child', 'Family', 'Couple', 'Coaching'];
const specializationOptionsList = [
  "Sexology",
  "Addictions",
  "Eating Disorders",
  "Psychosomatic Disorders",
  "Obsessive-Compulsive Disorder (OCCD)",
];
const consultationOptionsList = [
  "Anxiety",
  "Low self-esteem",
  "Suicidal thoughts",
  "Depression",
  "Grief",
];
const languageOptions = ["English", "Spanish", "Portuguese"];

const getCityName = (place: any) => {
  if (!place || !place.address_components) return place?.name || "";
  let city = "";
  for (const component of place.address_components) {
    const types = component.types;
    if (types.includes("locality")) {
      city = component.long_name;
      break;
    } else if (types.includes("administrative_area_level_3")) {
      city = component.long_name;
    } else if (types.includes("sublocality_level_1") && !city) {
      city = component.long_name;
    }
  }
  return city || place.name || "";
};

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

const MyProfile = () => {
  const router = useRouter();
  const { userDetails, login } = useAuth();

  const [specializationOptions, setSpecializationOptions] = useState<
    { id: any; name: string }[]
  >([]);
  const [consultationOptions, setConsultationOptions] = useState<
    { id: any; name: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isUnderReviewModalOpen, setIsUnderReviewModalOpen] = useState(false);
  const [isApprovedModalOpen, setIsApprovedModalOpen] = useState(false);
  const [isRejectedModalOpen, setIsRejectedModalOpen] = useState(false);

  const [therapyOptions, setTherapyOptions] = useState<
    { id: number; name: string }[]
  >([]);

  // Verification state tracking
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [initialEmailIsNull, setInitialEmailIsNull] = useState(false);
  const [initialPhoneIsNull, setInitialPhoneIsNull] = useState(false);

  // OTP Verification modal state
  const [otpVerifyOpen, setOtpVerifyOpen] = useState(false);
  const [otpVerifyType, setOtpVerifyType] = useState<"email" | "phone">(
    "email"
  );
  const [otpVerifyVal, setOtpVerifyVal] = useState("");

  const [formData, setFormData] = useState<any>({
    userImage: null,
    profile_image_url: "",
    full_name: "",
    sur_name: "",
    surname_two: "",
    contact_number: "",
    email: "",
    vat_number: "",
    doctype: "DNI",
    dni_number: "",
    scholarShipId: "",
    street_number_floor: "",
    city: "",
    postal_code: "",
    province: "",
    country: "",
    certificate: [],
    sessionMode: ["online"],
    clinic_name: "",
    clinicAddress: "",
    specilizations: [],
    experience: "",
    bio: "",
    // therapyTypes: ['Child', 'Couple'],
    therapyTypes: [] as number[],
    consultationReasons: [],
    languages: "",

    latitude: "",
    longitude: "",
    clinic_latitude: "",
    clinic_longitude: "",
  });

  // Pre-populate email or contact number from context
  useEffect(() => {
    const credential =
      userDetails?.email ||
      userDetails?.emailPhone ||
      userDetails?.contact_number ||
      userDetails?.user?.email ||
      userDetails?.data?.user?.email ||
      userDetails?.user?.emailPhone ||
      userDetails?.data?.user?.emailPhone ||
      userDetails?.user_details?.[0]?.email;
    if (credential) {
      const isEmail = credential.includes("@");
      setFormData((prev: any) => ({
        ...prev,
        email: isEmail ? credential : prev.email,
        contact_number: !isEmail ? credential : prev.contact_number,
      }));
    }
  }, [userDetails]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const [specsRes, reasonsRes, profileRes, sessionTypeRes] =
          await Promise.all([
            requestApi({ endpoint: "get-all-specialization", method: "POST" }),
            requestApi({
              endpoint: "get-consultation-reasons",
              method: "POST",
            }),
            requestApi({ endpoint: "get-therapist-profile", method: "POST" }),
            requestApi({ endpoint: "get-session-type", method: "POST" }),
          ]);

        // console.log("specsRes response:", specsRes);
        // console.log("reasonsRes response:", reasonsRes);

        let specs: any[] = [];
        if (specsRes) {
          if (Array.isArray(specsRes)) {
            specs = specsRes;
          } else if (Array.isArray(specsRes.data)) {
            specs = specsRes.data;
          } else if (specsRes.data && typeof specsRes.data === "object") {
            const arrayKey = Object.keys(specsRes.data).find((k) =>
              Array.isArray(specsRes.data[k])
            );
            if (arrayKey) {
              specs = specsRes.data[arrayKey];
            }
          }
        }

        let reasons: any[] = [];
        if (reasonsRes) {
          if (Array.isArray(reasonsRes)) {
            reasons = reasonsRes;
          } else if (Array.isArray(reasonsRes.data)) {
            reasons = reasonsRes.data;
          } else if (reasonsRes.data && typeof reasonsRes.data === "object") {
            const arrayKey = Object.keys(reasonsRes.data).find((k) =>
              Array.isArray(reasonsRes.data[k])
            );
            if (arrayKey) {
              reasons = reasonsRes.data[arrayKey];
            }
          }
        }

        const sessionTypes = sessionTypeRes?.data?.session_types || [];

        setTherapyOptions(sessionTypes);

        // Final fallback checks to guarantee arrays
        if (!Array.isArray(specs)) specs = [];
        if (!Array.isArray(reasons)) reasons = [];

        setSpecializationOptions(specs);
        setConsultationOptions(reasons);

        const therapist = profileRes?.data?.therapist;
        if (therapist) {
          const activeSpecs = therapist.specialization_id
            ? therapist.specialization_id
              .split(",")
              .map((idStr: string) => {
                const id = parseInt(idStr.trim(), 10);
                return specs.find((o: any) => Number(o.id) === id)?.name;
              })
              .filter(Boolean)
            : [];

          const activeReasons = therapist.reason_of_consultation_id
            ? therapist.reason_of_consultation_id
              .split(",")
              .map((idStr: string) => {
                const id = parseInt(idStr.trim(), 10);
                return reasons.find((o: any) => Number(o.id) === id)?.name;
              })
              .filter(Boolean)
            : [];

          const existingCerts = therapist.professional_certificates
            ? therapist.professional_certificates
              .split(",")
              .map((url: string) => ({
                name: url.substring(url.lastIndexOf("/") + 1),
                isRemote: true,
                url,
              }))
            : [];

          setFormData((prev: any) => ({
            ...prev,
            profile_image_url: therapist.profile_image || "",
            full_name: therapist.name || "",
            sur_name: therapist.surname_one || "",
            surname_two: therapist.surname_two || "",
            contact_number: therapist.phone || prev.contact_number || "",
            email: therapist.email || prev.email || "",
            vat_number: therapist.vat_number || "",
            doctype: therapist.doc_type
              ? therapist.doc_type.toUpperCase()
              : "DNI",
            dni_number: therapist.doc_number || "",
            scholarShipId: therapist.scholarship_id || "",
            street_number_floor: therapist.street_number_floor || "",
            city: therapist.city || prev.city || "",
            postal_code: therapist.postal_code || "",
            province: therapist.province || prev.province || "",
            country: therapist.country || prev.country || "",
            certificate: existingCerts,
            sessionMode: therapist.session_mode
              ? therapist.session_mode.split(",")
              : prev.sessionMode,
            clinic_name: therapist.clinic_name || "",
            clinicAddress: therapist.clinic_address || "",
            specilizations: activeSpecs,
            experience: therapist.years_of_experience
              ? String(therapist.years_of_experience)
              : "",
            bio: therapist.description || "",
            // therapyTypes: therapist.type_of_service ? therapist.type_of_service.split(',').map((t: string) => t.trim().charAt(0).toUpperCase() + t.trim().slice(1)) : prev.therapyTypes,
            therapyTypes: therapist.service_id
              ? String(therapist.service_id)
                .split(",")
                .map((id: string) => Number(id.trim()))
              : [],
            consultationReasons: activeReasons,
            languages: therapist.language || "",

            latitude: therapist.latitude || "",
            longitude: therapist.longitude || "",
            clinic_latitude: therapist.clinic_latitude || "",
            clinic_longitude: therapist.clinic_longitude || "",
          }));

          const emailNull = !therapist.email;
          const phoneNull = !therapist.phone;
          setInitialEmailIsNull(emailNull);
          setInitialPhoneIsNull(phoneNull);
          setIsEmailVerified(!emailNull);
          setIsPhoneVerified(!phoneNull);

          if (Number(therapist.is_profile_completed) === 1) {
            if (therapist.approval_status === "approved") {
              router.push("/dashboard");
              return;
            } else if (therapist.approval_status === "rejected") {
              setIsRejectedModalOpen(true);
            } else {
              setIsUnderReviewModalOpen(true);
            }
          }
        }
      } catch (err) {
        console.error("Error loading profile configuration data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [specSearch, setSpecSearch] = useState("");
  const [consSearch, setConsSearch] = useState("");
  const [customSpecInput, setCustomSpecInput] = useState("");
  const [errors, setErrors] = useState<any>({});

  const photoInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const streetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clinicTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const [clinicSuggestions, setClinicSuggestions] = useState<any[]>([]);

  // Modal state for local certificate upload
  const [showCertModal, setShowCertModal] = useState(false);
  const [modalCertName, setModalCertName] = useState("");
  const [modalCertFile, setModalCertFile] = useState<File | null>(null);

  const handleStreetSearch = (query: string) => {
    if (streetTimeoutRef.current) clearTimeout(streetTimeoutRef.current);
    if (!query) {
      setStreetSuggestions([]);
      return;
    }
    streetTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=5`
        );
        const data = await res.json();
        setStreetSuggestions(data);
      } catch (err) {
        console.error(err);
      }
    }, 500);
  };

  const handleClinicSearch = (query: string) => {
    if (clinicTimeoutRef.current) clearTimeout(clinicTimeoutRef.current);
    if (!query) {
      setClinicSuggestions([]);
      return;
    }
    clinicTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=5`
        );
        const data = await res.json();
        setClinicSuggestions(data);
      } catch (err) {
        console.error(err);
      }
    }, 500);
  };

  const handleSelectStreet = (sug: any) => {
    setFormData((prev: any) => ({
      ...prev,
      street_number_floor: sug.display_name,
      city:
        sug.address?.city ||
        sug.address?.town ||
        sug.address?.village ||
        prev.city,
      postal_code: sug.address?.postcode || prev.postal_code,
      country: sug.address?.country || prev.country,
      province: sug.address?.state || prev.province,
      latitude: sug.lat || prev.latitude,
      longitude: sug.lon || prev.longitude,
    }));
    setStreetSuggestions([]);
    if (errors.street_number_floor)
      setErrors((prev: any) => ({ ...prev, street_number_floor: null }));
    if (errors.city) setErrors((prev: any) => ({ ...prev, city: null }));
    if (errors.postal_code)
      setErrors((prev: any) => ({ ...prev, postal_code: null }));
    if (errors.country) setErrors((prev: any) => ({ ...prev, country: null }));
    if (errors.province)
      setErrors((prev: any) => ({ ...prev, province: null }));
  };

  const handleSelectClinic = (sug: any) => {
    setFormData((prev: any) => ({
      ...prev,
      clinicAddress: sug.display_name,
      clinic_latitude: sug.lat || prev.clinic_latitude,
      clinic_longitude: sug.lon || prev.clinic_longitude,
    }));
    setClinicSuggestions([]);
    if (errors.clinicAddress)
      setErrors((prev: any) => ({ ...prev, clinicAddress: null }));
  };

  const toggleDropdown = (name: string) => {
    if (openDropdown === name) setOpenDropdown(null);
    else setOpenDropdown(name);
  };

  const handleToggleArrayItem = (field: string, item: string | number) => {
    setFormData((prev: any) => {
      const currentArray = prev[field] || [];
      if (currentArray.includes(item)) {
        return {
          ...prev,
          [field]: currentArray.filter((i: any) => i !== item),
        };
      } else {
        return { ...prev, [field]: [...currentArray, item] };
      }
    });
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: null }));
  };

  const handleToggleLanguage = (lang: string) => {
    setFormData((prev: any) => {
      const currentLangs = prev.languages
        ? prev.languages
          .split(",")
          .map((l: string) => l.trim())
          .filter(Boolean)
        : [];
      let nextLangs: string[];
      if (currentLangs.includes(lang)) {
        nextLangs = currentLangs.filter((l: string) => l !== lang);
      } else {
        nextLangs = [...currentLangs, lang];
      }
      return {
        ...prev,
        languages: nextLangs.join(", "),
      };
    });
    if (errors.languages)
      setErrors((prev: any) => ({ ...prev, languages: null }));
  };

  const getSelectedLanguages = () => {
    return formData.languages
      ? formData.languages
        .split(",")
        .map((l: string) => l.trim())
        .filter(Boolean)
      : [];
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;

    let updatedValue = value;

    if (name === "contact_number") {
      updatedValue = value.replace(/\D/g, "").slice(0, 10);
    }
    setFormData((prev: any) => ({ ...prev, [name]: updatedValue }));
    if (errors[name]) setErrors((prev: any) => ({ ...prev, [name]: null }));
  };

  const handlePhotoUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev: any) => ({ ...prev, userImage: file }));
      if (errors.profile_image)
        setErrors((prev: any) => ({ ...prev, profile_image: null }));
    }
  };

  const handleCertUpload = (e: any) => {
    const files = Array.from(e.target.files || []);
    setFormData((prev: any) => ({
      ...prev,
      certificate: [...prev.certificate, ...files],
    }));
    if (errors.certificate)
      setErrors((prev: any) => ({ ...prev, certificate: null }));
  };

  const handleModalCertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCertName.trim()) {
      toast.error("Please enter a certificate name");
      return;
    }
    if (!modalCertFile) {
      toast.error("Please select a file to upload");
      return;
    }

    const fileToSave = modalCertFile;
    (fileToSave as any).customName = modalCertName.trim();

    setFormData((prev: any) => ({
      ...prev,
      certificate: [...prev.certificate, fileToSave],
    }));

    if (errors.certificate) {
      setErrors((prev: any) => ({ ...prev, certificate: null }));
    }

    setShowCertModal(false);
    setModalCertName("");
    setModalCertFile(null);
  };

  const handleRemoveCert = (indexToRemove: number) => {
    setFormData((prev: any) => ({
      ...prev,
      certificate: prev.certificate.filter(
        (_: any, index: number) => index !== indexToRemove
      ),
    }));
  };

  const handleAddCustomSpec = async () => {
    if (!customSpecInput.trim()) {
      toast.error("Please enter a specialization name to add.");
      return;
    }
    if (customSpecInput.trim()) {
      const trimmed = customSpecInput.trim();
      const exists = specializationOptions.some(
        (o) => o.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (!exists) {
        try {
          const specPayload = new FormData();
          specPayload.append("specialization", trimmed);
          await requestApi({
            endpoint: "add-specialization",
            method: "POST",
            data: specPayload,
            isFormData: true,
          });
          const specsRes = await requestApi({
            endpoint: "get-all-specialization",
            method: "POST",
          });

          let specs: any[] = [];
          if (specsRes) {
            if (Array.isArray(specsRes)) {
              specs = specsRes;
            } else if (Array.isArray(specsRes.data)) {
              specs = specsRes.data;
            } else if (specsRes.data && typeof specsRes.data === "object") {
              const arrayKey = Object.keys(specsRes.data).find((k) =>
                Array.isArray(specsRes.data[k])
              );
              if (arrayKey) {
                specs = specsRes.data[arrayKey];
              }
            }
          }
          if (!Array.isArray(specs)) specs = [];
          setSpecializationOptions(specs);
        } catch (err) {
          console.error(
            "Failed to add custom specialization backend-side:",
            err
          );
        }
      }

      if (
        !formData.specilizations.some(
          (s: string) => s.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        setFormData((prev: any) => ({
          ...prev,
          specilizations: [...prev.specilizations, trimmed],
        }));
      }
      setCustomSpecInput("");
      if (errors.specilizations)
        setErrors((prev: any) => ({ ...prev, specilizations: null }));
    }
  };

  const handleSendOtp = async (type: "email" | "phone") => {
    const value = type === "email" ? formData.email : formData.contact_number;
    if (!value) {
      toast.error(
        `Please enter your ${type === "email" ? "email" : "contact number"}.`
      );
      return;
    }
    if (type === "email" && !value.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (type === "phone" && value.length < 10) {
      toast.error("Please enter a valid 10-digit contact number.");
      return;
    }

    try {
      toast.loading("Sending OTP...", { id: "send-otp" });
      const payload = new FormData();
      payload.append("emailPhone", value);

      const res = await requestApi({
        endpoint: "verify-email-phone-therapist",
        method: "POST",
        data: payload,
        isFormData: true,
      });

      toast.dismiss("send-otp");

      if (res.success || res.status) {
        toast.success("OTP sent successfully!");
        setOtpVerifyType(type);
        setOtpVerifyVal(value);
        setOtpVerifyOpen(true);
      } else {
        toast.error(res.message || "Failed to send OTP.");
      }
    } catch (err: any) {
      toast.dismiss("send-otp");
      console.error(err);
      toast.error(
        err.response?.data?.message || err.message || "Error sending OTP."
      );
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.userImage && !formData.profile_image_url) {
      newErrors.profile_image = "Profile picture is required";
    }
    if (!formData.full_name || !formData.full_name.trim()) {
      newErrors.full_name = "Full Name is required";
    }
    if (!formData.sur_name || !formData.sur_name.trim()) {
      newErrors.sur_name = "Surname 1 is required";
    }
    if (!formData.contact_number || !formData.contact_number.trim()) {
      newErrors.contact_number = "Contact Number is required";
    } else if (formData.contact_number.replace(/\D/g, "").length < 10) {
      newErrors.contact_number = "Contact number must be at least 10 digits";
    } else if (initialPhoneIsNull && !isPhoneVerified) {
      newErrors.contact_number =
        "Please verify your contact number via OTP first";
    }
    if (!formData.email || !formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    } else if (initialEmailIsNull && !isEmailVerified) {
      newErrors.email = "Please verify your email address via OTP first";
    }
    if (!formData.vat_number || !formData.vat_number.trim()) {
      newErrors.vat_number = "VAT Number is required";
    }
    if (!formData.doctype || !formData.doctype.trim()) {
      newErrors.doctype = "Type of Document is required";
    }
    if (!formData.dni_number || !formData.dni_number.trim()) {
      newErrors.dni_number = "DNI / Document Number is required";
    }
    if (!formData.scholarShipId || !formData.scholarShipId.trim()) {
      newErrors.scholarShipId = "Scholarship ID is required";
    }
    if (!formData.street_number_floor || !formData.street_number_floor.trim()) {
      newErrors.street_number_floor = "Street address is required";
    }
    if (!formData.city || !formData.city.trim()) {
      newErrors.city = "City is required";
    }
    if (!formData.postal_code || !formData.postal_code.trim()) {
      newErrors.postal_code = "Postal Code is required";
    }
    if (!formData.province || !formData.province.trim()) {
      newErrors.province = "Province is required";
    }
    if (!formData.country || !formData.country.trim()) {
      newErrors.country = "Country is required";
    }
    if (!formData.clinic_name || !formData.clinic_name.trim()) {
      newErrors.clinic_name = "Clinic Name is required";
    }
    if (!formData.clinicAddress || !formData.clinicAddress.trim()) {
      newErrors.clinicAddress = "Clinic Address is required";
    }
    if (formData.certificate.length === 0) {
      newErrors.certificate = "Please upload at least one certification";
    }
    if (formData.sessionMode.length === 0) {
      newErrors.sessionMode = "Please select at least one session mode";
    }
    if (formData.therapyTypes.length === 0) {
      newErrors.therapyTypes = "Please select at least one type of therapy";
    }
    if (formData.specilizations.length === 0) {
      newErrors.specilizations = "Please select at least one specialization";
    }
    if (formData.consultationReasons.length === 0) {
      newErrors.consultationReasons =
        "Please select at least one reason for consultation";
    }
    if (!formData.experience || !String(formData.experience).trim()) {
      newErrors.experience = "Experience is required";
    } else if (
      isNaN(Number(formData.experience)) ||
      Number(formData.experience) < 0
    ) {
      newErrors.experience = "Experience must be a valid positive number";
    }
    if (!formData.languages || !formData.languages.trim()) {
      newErrors.languages = "Languages is required";
    }
    if (!formData.bio || !formData.bio.trim()) {
      newErrors.bio = "Bio / Description is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (validateForm()) {
      try {
        setIsSubmitting(true);

        const payload = new FormData();
        payload.append("full_name", formData.full_name);
        payload.append("surname_one", formData.sur_name);
        payload.append("surname_two", formData.surname_two || "");
        payload.append("vat_number", formData.vat_number);
        payload.append("document_type", formData.doctype.toLowerCase());
        payload.append("document_number", formData.dni_number || "");
        payload.append("scholarship_id", formData.scholarShipId || "");
        payload.append("street_number_floor", formData.street_number_floor);
        payload.append("city", formData.city);
        payload.append("postal_code", formData.postal_code);
        payload.append("province", formData.province);
        payload.append("country", formData.country);
        payload.append("session_mode", formData.sessionMode.join(","));
        payload.append("clinic_name", formData.clinic_name || "");
        payload.append("clinic_address", formData.clinicAddress || "");
        payload.append("latitude", formData.latitude || "");
        payload.append("longitude", formData.longitude || "");
        payload.append("clinic_latitude", formData.clinic_latitude || "");
        payload.append("clinic_longitude", formData.clinic_longitude || "");
        // payload.append('type_of_service[]', formData.therapyTypes.map((t: string) => t.toLowerCase()).join(','));
        payload.append("service_id[]", formData.therapyTypes.join(","));

        // Map specialization names to their IDs
        const specIds = formData.specilizations
          .map(
            (name: string) =>
              specializationOptions.find(
                (o) => o.name.toLowerCase() === name.toLowerCase()
              )?.id
          )
          .filter(Boolean)
          .join(",");
        payload.append("specialization_id[]", specIds);

        // Map consultation reason names to their IDs
        const reasonIds = formData.consultationReasons
          .map(
            (name: string) =>
              consultationOptions.find(
                (o) => o.name.toLowerCase() === name.toLowerCase()
              )?.id
          )
          .filter(Boolean)
          .join(",");
        payload.append("reason_of_consultation_id[]", reasonIds);

        payload.append("experience", formData.experience);
        payload.append("description", formData.bio);
        payload.append("languages", formData.languages);

        if (formData.userImage) {
          payload.append("profile_image", formData.userImage);
        }

        // Upload only local certificate files
        formData.certificate.forEach((file: any) => {
          if (!file.isRemote) {
            payload.append("certificates[]", file);
            if (file.customName) {
              payload.append("certificates_name[]", file.customName);
            }
          }
        });

        // Convert FormData to a readable JSON object for debugging
        const debugObj: Record<string, any> = {};
        payload.forEach((value, key) => {
          let itemValue: any = value;
          if (value instanceof File) {
            itemValue = {
              name: value.name,
              size: value.size,
              type: value.type,
            };
          }
          if (Object.prototype.hasOwnProperty.call(debugObj, key)) {
            if (Array.isArray(debugObj[key])) {
              debugObj[key].push(itemValue);
            } else {
              debugObj[key] = [debugObj[key], itemValue];
            }
          } else {
            debugObj[key] = itemValue;
          }
        });
        console.log(
          "Submitting therapist profile payload (JSON readable):",
          JSON.stringify(debugObj, null, 2)
        );

        const response = await requestApi({
          endpoint: "update-therapist-profile",
          method: "POST",
          data: payload,
          isFormData: true,
        });

        if (response.success || response.status) {
          toast.success("Profile submitted successfully!");
          // Trigger the submission popup
          setIsSubmitModalOpen(true);
        } else {
          toast.error(response.message || "Failed to update therapist profile");
        }
      } catch (err: any) {
        console.error("Error submitting therapist profile updates:", err);
        const errMsg =
          err.response?.data?.message ||
          err.message ||
          "Error updating therapist profile";
        toast.error(errMsg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  if (isLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh" }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="therapist-profile-container py-5">
        <div className="container-fluid m-auto" style={{ maxWidth: "1366px" }}>
          <header className="tp-header mb-5">
            <div className="tp-back-btn">
              <a href="#" className="tp-back-btn">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </a>
              <span>Complete Your Profile</span>
            </div>
            <p className="tp-subtitle">
              Please provide your professional details
            </p>
          </header>

          <form id="profileForm" onSubmit={handleSubmit} noValidate>
            <section className="tp-section mb-5">
              <h2 className="tp-section-title">
                <span className="icon">
                  <img src="/images/personal-user-icon.svg" alt="" />
                </span>{" "}
                Personal Details
              </h2>

              <div className="tp-avatar-uploader mb-4">
                <div className="avatar-preview">
                  {formData.userImage ? (
                    <img
                      src={URL.createObjectURL(formData.userImage)}
                      alt="Preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  ) : formData.profile_image_url ? (
                    <img
                      src={
                        formData.profile_image_url.startsWith("http")
                          ? formData.profile_image_url
                          : `${Base_image_url}${formData.profile_image_url}`
                      }
                      alt="Preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  ) : (
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  ref={photoInputRef}
                  onChange={handlePhotoUpload}
                />
                <button
                  type="button"
                  className="tp-btn-secondary"
                  onClick={() => photoInputRef.current?.click()}
                >
                  Upload Photo
                </button>
                {errors.profile_image && (
                  <div
                    style={{ color: "red", fontSize: "12px", marginTop: "6px" }}
                  >
                    {errors.profile_image}
                  </div>
                )}
              </div>

              <div className="row g-4">
                <div className="col-md-4">
                  <label className="tp-label">Full Name*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter your full name"
                    required
                    name="full_name"
                    value={formData.full_name || ""}
                    onChange={handleInputChange}
                  />
                  {errors.full_name && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.full_name}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Surname 1*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter your surname 1"
                    required
                    name="sur_name"
                    value={formData.sur_name || ""}
                    onChange={handleInputChange}
                  />
                  {errors.sur_name && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.sur_name}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Surname 2 (Optional)</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter your surname 2"
                    name="surname_two"
                    value={formData.surname_two || ""}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-4">
                  <label className="tp-label">Contact Number*</label>
                  <div className="position-relative d-flex align-items-center">
                    <input
                      type="text"
                      className="tp-input w-100"
                      style={{
                        paddingRight:
                          initialPhoneIsNull && !isPhoneVerified
                            ? "75px"
                            : isPhoneVerified
                              ? "85px"
                              : "12px",
                      }}
                      placeholder="+1234567890"
                      required
                      name="contact_number"
                      value={formData.contact_number || ""}
                      onChange={handleInputChange}
                      maxLength={10}
                      inputMode="numeric"
                      disabled={isPhoneVerified}
                    />
                    {initialPhoneIsNull &&
                      !isPhoneVerified &&
                      formData.contact_number && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary position-absolute"
                          style={{
                            right: "8px",
                            zIndex: 5,
                            fontSize: "11px",
                            padding: "4px 8px",
                            background: "#4F46E5",
                            border: "none",
                            borderRadius: "4px",
                            color: "#fff",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                          onClick={() => handleSendOtp("phone")}
                        >
                          Verify
                        </button>
                      )}
                    {isPhoneVerified && (
                      <span
                        className="position-absolute text-success d-flex align-items-center"
                        style={{
                          right: "12px",
                          zIndex: 5,
                          pointerEvents: "none",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="me-1"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                          Verified
                        </span>
                      </span>
                    )}
                  </div>
                  {errors.contact_number && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.contact_number}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Email*</label>
                  <div className="position-relative d-flex align-items-center">
                    <input
                      type="email"
                      className="tp-input w-100"
                      style={{
                        paddingRight:
                          initialEmailIsNull && !isEmailVerified
                            ? "75px"
                            : isEmailVerified
                              ? "85px"
                              : "12px",
                      }}
                      placeholder="Enter your email"
                      required
                      name="email"
                      value={formData.email || ""}
                      onChange={handleInputChange}
                      disabled={isEmailVerified}
                    />
                    {initialEmailIsNull &&
                      !isEmailVerified &&
                      formData.email && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary position-absolute"
                          style={{
                            right: "8px",
                            zIndex: 5,
                            fontSize: "11px",
                            padding: "4px 8px",
                            background: "#4F46E5",
                            border: "none",
                            borderRadius: "4px",
                            color: "#fff",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                          onClick={() => handleSendOtp("email")}
                        >
                          Verify
                        </button>
                      )}
                    {isEmailVerified && (
                      <span
                        className="position-absolute text-success d-flex align-items-center"
                        style={{
                          right: "12px",
                          zIndex: 5,
                          pointerEvents: "none",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="me-1"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                          Verified
                        </span>
                      </span>
                    )}
                  </div>
                  {errors.email && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.email}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">VAT Number*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter VAT number"
                    required
                    name="vat_number"
                    value={formData.vat_number || ""}
                    onChange={handleInputChange}
                  />
                  {errors.vat_number && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.vat_number}
                    </div>
                  )}
                </div>

                <div className="col-md-4">
                  <label className="tp-label">Type of Document*</label>
                  <div className="tp-custom-select-wrapper">
                    <div
                      className="tp-select-trigger"
                      onClick={() => toggleDropdown("docDropdown")}
                    >
                      <span id="selectedDoc">
                        {(formData.doctype || "Select").replace("_", " ")}
                      </span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="arrow"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    <div
                      className="tp-dropdown-menu"
                      id="docDropdown"
                      style={{
                        display:
                          openDropdown === "docDropdown" ? "block" : "none",
                      }}
                    >
                      {documentOptions.map((doc) => (
                        <div
                          key={doc}
                          className={`tp-dropdown-item ${formData.doctype === doc ? "active" : ""
                            }`}
                          onClick={() => {
                            setFormData({ ...formData, doctype: doc });
                            setOpenDropdown(null);
                            if (errors.doctype)
                              setErrors((prev: any) => ({
                                ...prev,
                                doctype: null,
                              }));
                          }}
                        >
                          {doc.replace("_", " ")}
                        </div>
                      ))}
                    </div>
                  </div>
                  {errors.doctype && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.doctype}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">DNI Number*</label>
                  <input
                    type="text"
                    className="tp-input"
                    name="dni_number"
                    value={formData.dni_number || ""}
                    onChange={handleInputChange}
                  />
                  {errors.dni_number && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.dni_number}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Scholarship ID*</label>
                  <input
                    type="text"
                    className="tp-input"
                    name="scholarShipId"
                    value={formData.scholarShipId || ""}
                    onChange={handleInputChange}
                  />
                  {errors.scholarShipId && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.scholarShipId}
                    </div>
                  )}
                </div>

                <div className="col-md-4 position-relative">
                  <label className="tp-label">Street-number-floor*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="350 Fifth Avenue, Suite 500"
                    required
                    name="street_number_floor"
                    value={formData.street_number_floor || ""}
                    onChange={(e) => {
                      handleInputChange(e);
                      handleStreetSearch(e.target.value);
                    }}
                    autoComplete="off"
                  />
                  {errors.street_number_floor && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.street_number_floor}
                    </div>
                  )}
                  {streetSuggestions.length > 0 && (
                    <div
                      className="tp-dropdown-menu"
                      style={{
                        display: "block",
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {streetSuggestions.map((sug: any, idx: number) => (
                        <div
                          key={idx}
                          className="tp-dropdown-item"
                          onClick={() => handleSelectStreet(sug)}
                          style={{
                            whiteSpace: "normal",
                            fontSize: "13px",
                            padding: "8px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {sug.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">City*</label>
                  <Autocomplete
                    key={isLoading ? "loading-city" : "city"}
                    apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                    onPlaceSelected={(place) => {
                      const extracted = extractAddressComponents(place);
                      const lat = place.geometry?.location?.lat();
                      const lng = place.geometry?.location?.lng();
                      setFormData((prev: any) => ({
                        ...prev,
                        city: extracted.city || prev.city,
                        province: extracted.province || prev.province,
                        postal_code: extracted.postalCode || prev.postal_code,
                        country: extracted.country || prev.country,
                        latitude: lat ? String(lat) : prev.latitude,
                        longitude: lng ? String(lng) : prev.longitude,
                      }));
                      if (errors.city)
                        setErrors((prev: any) => ({ ...prev, city: null }));
                      if (errors.province)
                        setErrors((prev: any) => ({ ...prev, province: null }));
                      if (errors.postal_code)
                        setErrors((prev: any) => ({
                          ...prev,
                          postal_code: null,
                        }));
                      if (errors.country)
                        setErrors((prev: any) => ({ ...prev, country: null }));
                    }}
                    options={{
                      types: ["(cities)"],
                    }}
                    className="tp-input"
                    placeholder="Enter city"
                    name="city"
                    value={formData.city || ""}
                    onChange={(e: any) => {
                      setFormData((prev: any) => ({
                        ...prev,
                        city: e.target.value,
                      }));
                      if (errors.city)
                        setErrors((prev: any) => ({ ...prev, city: null }));
                    }}
                  />
                  {errors.city && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.city}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Postal Code*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter postal code"
                    required
                    name="postal_code"
                    value={formData.postal_code || ""}
                    onChange={handleInputChange}
                  />
                  {errors.postal_code && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.postal_code}
                    </div>
                  )}
                </div>

                <div className="col-md-4">
                  <label className="tp-label">Province*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter province"
                    required
                    name="province"
                    value={formData.province || ""}
                    onChange={handleInputChange}
                  />
                  {errors.province && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.province}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Country*</label>
                  <Autocomplete
                    key={isLoading ? "loading-country" : "country"}
                    apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                    onPlaceSelected={(place) => {
                      const countryName = getCountryName(place);
                      const lat = place.geometry?.location?.lat();
                      const lng = place.geometry?.location?.lng();
                      setFormData((prev: any) => ({
                        ...prev,
                        country: countryName,
                        latitude: lat ? String(lat) : prev.latitude,
                        longitude: lng ? String(lng) : prev.longitude,
                      }));
                      if (errors.country)
                        setErrors((prev: any) => ({ ...prev, country: null }));
                    }}
                    options={{
                      types: ["country"],
                    }}
                    className="tp-input"
                    placeholder="Enter country"
                    name="country"
                    value={formData.country || ""}
                    onChange={(e: any) => {
                      setFormData((prev: any) => ({
                        ...prev,
                        country: e.target.value,
                      }));
                      if (errors.country)
                        setErrors((prev: any) => ({ ...prev, country: null }));
                    }}
                  />
                  {errors.country && (
                    <div
                      style={{
                        color: "red",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      {errors.country}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Clinic Name*</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter clinic name"
                    name="clinic_name"
                    value={formData.clinic_name || ""}
                    onChange={handleInputChange}
                  />
                  {errors.clinic_name && (
                    <div
                      style={{
                        color: "red",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      {errors.clinic_name}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="tp-label">Clinic Address*</label>
                  <div
                    className="tp-input-icon-wrapper position-relative"
                    id="clinic-address-wrapper"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="icon-left"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <Autocomplete
                      key={isLoading ? "loading-clinic" : "clinic"}
                      apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                      onPlaceSelected={(place) => {
                        const address =
                          place.formatted_address || place.name || "";
                        const lat = place.geometry?.location?.lat();
                        const lng = place.geometry?.location?.lng();
                        setFormData((prev: any) => ({
                          ...prev,
                          clinicAddress: address,
                          clinic_latitude: lat
                            ? String(lat)
                            : prev.clinic_latitude,
                          clinic_longitude: lng
                            ? String(lng)
                            : prev.clinic_longitude,
                        }));
                        if (errors.clinicAddress)
                          setErrors((prev: any) => ({
                            ...prev,
                            clinicAddress: null,
                          }));
                      }}
                      className="tp-input"
                      placeholder="Enter clinic address"
                      name="clinicAddress"
                      value={formData.clinicAddress || ""}
                      onChange={(e: any) => {
                        setFormData((prev: any) => ({
                          ...prev,
                          clinicAddress: e.target.value,
                        }));
                        if (errors.clinicAddress)
                          setErrors((prev: any) => ({
                            ...prev,
                            clinicAddress: null,
                          }));
                      }}
                      style={{ paddingLeft: "40px" }}
                    />
                  </div>
                  {errors.clinicAddress && (
                    <div
                      style={{
                        color: "red",
                        fontSize: "12px",
                        marginTop: "5px",
                      }}
                    >
                      {errors.clinicAddress}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="tp-section mb-5">
              <h2 className="tp-section-title">
                <span className="icon">💼</span> Certificate
              </h2>
              <label className="tp-label mb-2">
                Upload your professional certifications*
              </label>

              <div className="tp-file-uploader-box mb-3">
                <button
                  type="button"
                  className="tp-btn-file-select"
                  onClick={() => setShowCertModal(true)}
                >
                  Choose File
                </button>
                <span className="text-muted ms-3 fs-7">
                  {formData.certificate.length > 0
                    ? `${formData.certificate.length} File(s) Chosen`
                    : "No File Chosen"}
                </span>
              </div>
              {errors.certificate && (
                <div
                  style={{
                    color: "red",
                    fontSize: "12px",
                    marginBottom: "10px",
                  }}
                >
                  {errors.certificate}
                </div>
              )}

              <div className="row g-2">
                {formData.certificate.map((file: any, idx: number) => {
                  const isRemote = file.isRemote;
                  const name = file.customName || file.name;
                  const size = file.size
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                    : "Remote";
                  return (
                    <div key={idx} className="col-sm-6 col-md-3">
                      <div className="tp-file-badge">
                        <div className="text-truncate flex-grow-1 me-2">
                          <span className="file-name d-block text-truncate">
                            {name}
                          </span>
                          <span className="file-size">{size}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-close-file"
                          onClick={() => handleRemoveCert(idx)}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="tp-section mb-5">
              <h2 className="tp-section-title">
                <span className="icon">📄</span> Category Selection
              </h2>

              <div className="tp-panel p-4 mb-4">
                <label className="tp-label mb-2">Select session mode</label>
                <div className="d-flex gap-2 mb-3 flex-wrap">
                  <button
                    type="button"
                    className={`tp-toggle-pill ${formData.sessionMode.includes("online") ? "active" : ""
                      }`}
                    id="mode-online"
                    onClick={() =>
                      handleToggleArrayItem("sessionMode", "online")
                    }
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="me-1"
                    >
                      <path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"></path>
                      <polyline points="16 21 16 19 12 19"></polyline>
                    </svg>
                    Online
                  </button>
                  <button
                    type="button"
                    className={`tp-toggle-pill ${formData.sessionMode.includes("in_person") ? "active" : ""
                      }`}
                    id="mode-inperson"
                    onClick={() =>
                      handleToggleArrayItem("sessionMode", "in_person")
                    }
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="me-1"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    In-Person
                  </button>
                </div>
                {errors.sessionMode && (
                  <div
                    style={{
                      color: "red",
                      fontSize: "12px",
                      marginTop: "-10px",
                      marginBottom: "10px",
                    }}
                  >
                    {errors.sessionMode}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="tp-label mb-2">
                  Select the types of therapy you provide
                </label>
                <div
                  className="d-flex gap-2 flex-wrap"
                  id="therapy-types-container"
                >
                  {therapyOptions.map((therapy) => (
                    <button
                      key={therapy?.id}
                      type="button"
                      className={
                        formData.therapyTypes.includes(therapy?.id)
                          ? "tp-toggle-pill active"
                          : "tp-pill-outline"
                      }
                      onClick={() =>
                        handleToggleArrayItem("therapyTypes", therapy?.id)
                      }
                    >
                      {therapy?.name}
                    </button>
                  ))}
                </div>
                {errors.therapyTypes && (
                  <div
                    style={{
                      color: "red",
                      fontSize: "12px",
                      marginTop: "5px",
                    }}
                  >
                    {errors.therapyTypes}
                  </div>
                )}
              </div>
            </section>

            <section className="tp-section mb-5">
              <h2 className="tp-section-title">
                <span className="icon">💼</span> Professional Details
              </h2>

              <div className="mb-4 position-relative">
                <label className="tp-label">Specializations*</label>
                <div
                  className="tp-multi-select-trigger"
                  onClick={() => toggleDropdown("specializationDropdown")}
                >
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {formData.specilizations.map((spec: string) => (
                      <span key={spec} className="tp-tag">
                        {spec}{" "}
                        <span
                          className="tag-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArrayItem("specilizations", spec);
                          }}
                        >
                          &times;
                        </span>
                      </span>
                    ))}
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="arrow ms-auto"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
                {errors.specilizations && (
                  <div
                    style={{ color: "red", fontSize: "12px", marginTop: "5px" }}
                  >
                    {errors.specilizations}
                  </div>
                )}

                <div
                  className="tp-dropdown-panel-box"
                  id="specializationDropdown"
                  style={{
                    display:
                      openDropdown === "specializationDropdown"
                        ? "block"
                        : "none",
                  }}
                >
                  <div className="p-3 border-bottom">
                    <div className="tp-search-input-wrapper">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="search-icon"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search"
                        className="tp-search-field"
                        value={specSearch}
                        onChange={(e) => setSpecSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="panel-options-list">
                    {specializationOptions
                      .filter((o) =>
                        o.name.toLowerCase().includes(specSearch.toLowerCase())
                      )
                      .map((option) => (
                        <label key={option.id} className="tp-checkbox-item">
                          <span>{option.name}</span>
                          <input
                            type="checkbox"
                            checked={formData.specilizations.includes(
                              option.name
                            )}
                            onChange={() =>
                              handleToggleArrayItem(
                                "specilizations",
                                option.name
                              )
                            }
                          />
                          <span className="checkmark"></span>
                        </label>
                      ))}
                  </div>
                  <div className="p-3 border-top d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="tp-panel-btn btn-clear"
                      onClick={() =>
                        setFormData({ ...formData, specilizations: [] })
                      }
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="tp-panel-btn btn-apply"
                      onClick={() => setOpenDropdown(null)}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="tp-label">
                  Can't find the specialization? Add it here.
                </label>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="tp-input flex-grow-1"
                    placeholder="Type your specialization and press enter"
                    value={customSpecInput}
                    onChange={(e) => setCustomSpecInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), handleAddCustomSpec())
                    }
                  />
                  <button
                    type="button"
                    className="tp-btn-action-enter"
                    onClick={handleAddCustomSpec}
                  >
                    Enter
                  </button>
                </div>
              </div>

              <div className="mb-4 position-relative">
                <label className="tp-label">Reason for Consultation*</label>
                <div
                  className="tp-multi-select-trigger"
                  onClick={() => toggleDropdown("consultationDropdown")}
                >
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {formData.consultationReasons.map((reason: string) => (
                      <span key={reason} className="tp-tag">
                        {reason}{" "}
                        <span
                          className="tag-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArrayItem(
                              "consultationReasons",
                              reason
                            );
                          }}
                        >
                          &times;
                        </span>
                      </span>
                    ))}
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="arrow ms-auto"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
                {errors.consultationReasons && (
                  <div
                    style={{ color: "red", fontSize: "12px", marginTop: "5px" }}
                  >
                    {errors.consultationReasons}
                  </div>
                )}

                <div
                  className="tp-dropdown-panel-box"
                  id="consultationDropdown"
                  style={{
                    display:
                      openDropdown === "consultationDropdown"
                        ? "block"
                        : "none",
                  }}
                >
                  <div className="p-3 border-bottom">
                    <div className="tp-search-input-wrapper">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="search-icon"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search"
                        className="tp-search-field"
                        value={consSearch}
                        onChange={(e) => setConsSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="panel-options-list">
                    {consultationOptions
                      .filter((o) =>
                        o.name.toLowerCase().includes(consSearch.toLowerCase())
                      )
                      .map((option) => (
                        <label key={option.id} className="tp-checkbox-item">
                          <span>{option.name}</span>
                          <input
                            type="checkbox"
                            checked={formData.consultationReasons.includes(
                              option.name
                            )}
                            onChange={() =>
                              handleToggleArrayItem(
                                "consultationReasons",
                                option.name
                              )
                            }
                          />
                          <span className="checkmark"></span>
                        </label>
                      ))}
                  </div>
                  <div className="p-3 border-top d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="tp-panel-btn btn-clear"
                      onClick={() =>
                        setFormData({ ...formData, consultationReasons: [] })
                      }
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="tp-panel-btn btn-apply"
                      onClick={() => setOpenDropdown(null)}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <label className="tp-label">Experience (Years) *</label>
                  <input
                    type="text"
                    className="tp-input"
                    placeholder="Enter your years"
                    required
                    name="experience"
                    value={formData.experience || ""}
                    onChange={handleInputChange}
                  />
                  {errors.experience && (
                    <div style={{ color: "red", fontSize: "12px" }}>
                      {errors.experience}
                    </div>
                  )}
                </div>
                <div className="col-md-8 position-relative">
                  <label className="tp-label">Languages*</label>
                  <div
                    className="tp-multi-select-trigger"
                    onClick={() => toggleDropdown("languageDropdown")}
                  >
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      {getSelectedLanguages().length > 0 ? (
                        getSelectedLanguages().map((lang: string) => (
                          <span key={lang} className="tp-tag">
                            {lang}{" "}
                            <span
                              className="tag-close"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLanguage(lang);
                              }}
                            >
                              &times;
                            </span>
                          </span>
                        ))
                      ) : (
                        <span
                          className="text-muted"
                          style={{ fontSize: "14px" }}
                        >
                          Select languages
                        </span>
                      )}
                    </div>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="arrow ms-auto"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                  {errors.languages && (
                    <div
                      style={{
                        color: "red",
                        fontSize: "12px",
                        marginTop: "5px",
                      }}
                    >
                      {errors.languages}
                    </div>
                  )}

                  <div
                    className="tp-dropdown-panel-box"
                    id="languageDropdown"
                    style={{
                      display:
                        openDropdown === "languageDropdown" ? "block" : "none",
                      zIndex: 20,
                    }}
                  >
                    <div className="panel-options-list">
                      {languageOptions.map((option) => (
                        <label key={option} className="tp-checkbox-item">
                          <span>{option}</span>
                          <input
                            type="checkbox"
                            checked={getSelectedLanguages().includes(option)}
                            onChange={() => handleToggleLanguage(option)}
                          />
                          <span className="checkmark"></span>
                        </label>
                      ))}
                    </div>
                    <div className="p-3 border-top d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="tp-panel-btn btn-clear"
                        onClick={() =>
                          setFormData({ ...formData, languages: "" })
                        }
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="tp-panel-btn btn-apply"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="tp-label">Bio / Description*</label>
                <textarea
                  className="tp-textarea"
                  rows={4}
                  placeholder="Tell us about yourself and your approach to therapy..."
                  required
                  name="bio"
                  value={formData.bio || ""}
                  onChange={handleInputChange}
                ></textarea>
                {errors.bio && (
                  <div style={{ color: "red", fontSize: "12px" }}>
                    {errors.bio}
                  </div>
                )}
              </div>
            </section>

            <div className="mt-5">
              <button
                type="submit"
                className="tp-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Profile for Review"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SubmitProfile
        isOpen={isSubmitModalOpen}
        onClose={() => {
          setIsSubmitModalOpen(false);
          router.push("/login");
        }}
      />
      <ProfileUnderReviewPopup
        isOpen={isUnderReviewModalOpen}
        onClose={() => {
          setIsUnderReviewModalOpen(false);
          localStorage.clear()
          router.push("/login");
        }}
      />
      <ProfileApproved
        isOpen={isApprovedModalOpen}
        onClose={() => {
          setIsApprovedModalOpen(false);
          router.push("/dashboard");
        }}
      />
      <ProfileRejected
        isOpen={isRejectedModalOpen}
        onClose={() => {
          setIsRejectedModalOpen(false);
        }}
      />
      <OtpVerificationPopup
        isOpen={otpVerifyOpen}
        onClose={() => setOtpVerifyOpen(false)}
        emailPhone={otpVerifyVal}
        type={otpVerifyType}
        onSuccess={() => {
          if (otpVerifyType === "email") {
            setIsEmailVerified(true);
            if (errors.email)
              setErrors((prev: any) => ({ ...prev, email: null }));
          } else {
            setIsPhoneVerified(true);
            if (errors.contact_number)
              setErrors((prev: any) => ({ ...prev, contact_number: null }));
          }
        }}
      />

      {showCertModal && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1050,
          }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className="modal-content"
              style={{
                borderRadius: "16px",
                padding: "24px",
                border: "none",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="icon" style={{ fontSize: "20px" }}>💼</span>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a1a" }}>
                    Upload Certificate
                  </h3>
                </div>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#888",
                    lineHeight: 1,
                  }}
                  onClick={() => {
                    setShowCertModal(false);
                    setModalCertName("");
                    setModalCertFile(null);
                  }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleModalCertSubmit}>
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "6px",
                      color: "#333",
                    }}
                  >
                    Certificate Name*
                  </label>
                  <input
                    type="text"
                    required
                    value={modalCertName}
                    onChange={(e) => setModalCertName(e.target.value)}
                    placeholder="Enter certificate name"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "6px",
                      color: "#333",
                    }}
                  >
                    Upload File / Image*
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => setModalCertFile(e.target.files?.[0] || null)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                      background: "#fff",
                      color: "#555",
                      fontWeight: "500",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setShowCertModal(false);
                      setModalCertName("");
                      setModalCertFile(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tp-btn-submit"
                    style={{
                      padding: "9px 22px",
                      borderRadius: "8px",
                    }}
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MyProfile;
