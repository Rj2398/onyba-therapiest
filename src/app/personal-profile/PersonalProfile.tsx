"use client";

import React, { useRef, useState, useEffect } from "react";
import ReasonConsultationPopup from "@/src/component/personalprofilepopup/ReasonConsultationPopup";
import SpecializationPopup from "@/src/component/personalprofilepopup/SpecializationPopup";
import { MdOutlineWatchLater } from "react-icons/md";
import { toast } from "react-toastify";
import DateRangePicker, { DateRange } from "@/src/component/DateRangePicker";
import { ImBin } from "react-icons/im";
import { useAuth } from "@/src/app/UserProvider";
import { requestApi } from "@/src/utils/api";
import { API_BASE_URL, Base_image_url } from "@/src/config";
import Autocomplete from "react-google-autocomplete";
import axios from "axios";
import { uploadMedia } from "@/src/utils/formdataApi";
// Helper functions for Date formatting and conversion
const formatDateToYMD = (date: Date | null) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const convert24To12 = (timeStr: string) => {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, "0");
  return `${strHours}:${minutes} ${ampm}`;
};

const convert12To24 = (time12: string) => {
  if (!time12) return "";
  const [time, modifier] = time12.split(" ");
  let [hours, minutes] = time.split(":");
  if (hours === "12") {
    hours = "00";
  }
  if (modifier === "PM") {
    hours = String(parseInt(hours, 10) + 12);
  }
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const groupDatesToRanges = (dates: string[]): DateRange[] => {
  if (!dates || dates.length === 0) return [];
  const sorted = [...dates].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const ranges: DateRange[] = [];

  let start = new Date(sorted[0]);
  let prev = new Date(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const current = new Date(sorted[i]);
    const diffTime = Math.abs(current.getTime() - prev.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      prev = current;
    } else {
      ranges.push({ startDate: start, endDate: prev });
      start = current;
      prev = current;
    }
  }
  ranges.push({ startDate: start, endDate: prev });
  return ranges;
};

const mergeOverlappingRanges = (ranges: DateRange[]): DateRange[] => {
  if (ranges.length === 0) return [];
  const valid = ranges.filter((r) => r.startDate && r.endDate);
  if (valid.length === 0) return [];
  const sorted = [...valid].sort(
    (a, b) => a.startDate!.getTime() - b.startDate!.getTime()
  );

  const merged: DateRange[] = [
    {
      startDate: new Date(sorted[0].startDate!),
      endDate: new Date(sorted[0].endDate!),
    },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.startDate!.getTime() <= last.endDate!.getTime() + 86400000) {
      if (curr.endDate!.getTime() > last.endDate!.getTime()) {
        last.endDate = new Date(curr.endDate!);
      }
    } else {
      merged.push({
        startDate: new Date(curr.startDate!),
        endDate: new Date(curr.endDate!),
      });
    }
  }
  return merged;
};

const getDatesForWeekdayInMonth = (
  year: number,
  month: number,
  weekdayStr: string
) => {
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const targetDayIndex = weekdays.indexOf(weekdayStr);
  if (targetDayIndex === -1) return [];

  const dates: Date[] = [];
  const numDays = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= numDays; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === targetDayIndex) {
      dates.push(d);
    }
  }
  return dates;
};

const getApiErrorMessage = (response: any, fallbackMessage: string) => {
  if (response?.data && typeof response.data === "object") {
    const messages: string[] = [];
    Object.values(response.data).forEach((val: any) => {
      if (Array.isArray(val)) {
        messages.push(...val);
      } else if (typeof val === "string") {
        messages.push(val);
      }
    });
    if (messages.length > 0) return messages.join(" ");
  }
  return response?.message || fallbackMessage;
};

const PersonalProfile = () => {
  const { therapistProfile, saveTherapistProfile } = useAuth();
  const [specializationOptions, setSpecializationOptions] = useState<
    { id: any; name: string }[]
  >([]);
  const [consultationOptions, setConsultationOptions] = useState<
    { id: any; name: string }[]
  >([]);
  const [isEditing, setIsEditing] = useState(false);

  const [holidayRange, setHolidayRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [holidayList, setHolidayList] = useState<DateRange[]>([]);

  const [selectSession, setSelectSession] = useState(false);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);

  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [profileImage, setProfileImage] = useState(() => {
    const rawImg = therapistProfile?.profile_image;
    if (!rawImg) return "/images/user-personal-profile.svg";
    return rawImg.startsWith("http") ||
      rawImg.startsWith("data:") ||
      rawImg.startsWith("/")
      ? rawImg
      : `${Base_image_url}${rawImg}`;
  });

  const [saveForDate, setSaveForDate] = useState(false);
  const [saveForDay, setSaveForDay] = useState(false);

  const [profileData, setProfileData] = useState({
    fullName: therapistProfile?.name || "",
    surname1: therapistProfile?.surname_one || "",
    surname2: therapistProfile?.surname_two || "",
    contactNumber: therapistProfile?.phone || "",
    email: therapistProfile?.email || "",
    vatNumber: therapistProfile?.vat_number || "",
    streetAddress: therapistProfile?.street_number_floor || "",
    city: therapistProfile?.city || "",
    postalCode: therapistProfile?.postal_code || "",
    province: therapistProfile?.province || "",
    country: therapistProfile?.country || "",
    experience: String(therapistProfile?.years_of_experience || ""),
    bio: therapistProfile?.description || "",
  });

  // Category & Clinic Address edit states
  const [clinicNameInput, setClinicNameInput] = useState(
    therapistProfile?.clinic_name || ""
  );
  const [clinicAddressInput, setClinicAddressInput] = useState(
    therapistProfile?.clinic_address || ""
  );
  const [clinicLatitude, setClinicLatitude] = useState(
    therapistProfile?.clinic_latitude || ""
  );
  const [clinicLongitude, setClinicLongitude] = useState(
    therapistProfile?.clinic_longitude || ""
  );

  // Modal state for uploading certificates
  const [showCertModal, setShowCertModal] = useState(false);
  const [certName, setCertName] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  // Tax bracket states
  const [selectedTax, setSelectedTax] = useState<number>(
    therapistProfile?.tax_percentage
      ? Number(therapistProfile.tax_percentage)
      : 7
  );
  const [isEditingTax, setIsEditingTax] = useState(false);

  // Availability & Holiday fetch states
  const [holidays, setHolidays] = useState<string[]>([]);
  const [monthlyAvailability, setMonthlyAvailability] = useState<any[]>([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [slots, setSlots] = useState<
    { start_time: string; end_time: string }[]
  >([
    {
      start_time: "",
      end_time: "",
    },
  ]);

  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const streetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [certifications, setCertifications] = useState<any[]>([]);

  // Fetch initial meta info
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [specsRes, reasonsRes, profileRes] = await Promise.all([
          requestApi({ endpoint: "get-all-specialization", method: "POST" }),
          requestApi({ endpoint: "get-consultation-reasons", method: "POST" }),
          requestApi({ endpoint: "get-therapist-profile", method: "POST" }),
        ]);

        let specs: any[] = [];
        if (specsRes) {
          if (Array.isArray(specsRes)) {
            specs = specsRes;
          } else if (specsRes.data) {
            if (Array.isArray(specsRes.data)) {
              specs = specsRes.data;
            } else if (Array.isArray(specsRes.data.specializations)) {
              specs = specsRes.data.specializations;
            }
          }
        }
        setSpecializationOptions(specs);

        let reasons: any[] = [];
        if (reasonsRes) {
          if (Array.isArray(reasonsRes)) {
            reasons = reasonsRes;
          } else if (reasonsRes.data) {
            if (Array.isArray(reasonsRes.data)) {
              reasons = reasonsRes.data;
            } else if (Array.isArray(reasonsRes.data.reasons)) {
              reasons = reasonsRes.data.reasons;
            }
          }
        }
        setConsultationOptions(reasons);

        if (
          profileRes &&
          profileRes.success &&
          profileRes.data &&
          profileRes.data.therapist
        ) {
          saveTherapistProfile(profileRes.data.therapist);
        }
      } catch (e) {
        console.error("Failed to fetch meta in PersonalProfile:", e);
      }
    };
    fetchMeta();
  }, []);

  // Sync state when therapistProfile changes
  useEffect(() => {
    if (therapistProfile) {
      setProfileData({
        fullName: therapistProfile.name || "",
        surname1: therapistProfile.surname_one || "",
        surname2: therapistProfile.surname_two || "",
        contactNumber: therapistProfile.phone || "",
        email: therapistProfile.email || "",
        vatNumber: therapistProfile.vat_number || "",
        streetAddress: therapistProfile.street_number_floor || "",
        city: therapistProfile.city || "",
        postalCode: therapistProfile.postal_code || "",
        province: therapistProfile.province || "",
        country: therapistProfile.country || "",
        experience: String(therapistProfile.years_of_experience || ""),
        bio: therapistProfile.description || "",
      });

      if (therapistProfile.profile_image) {
        const rawImg = therapistProfile.profile_image;
        const imgUrl =
          rawImg.startsWith("http") ||
          rawImg.startsWith("data:") ||
          rawImg.startsWith("/")
            ? rawImg
            : `${Base_image_url}${rawImg}`;
        setProfileImage(imgUrl);
      }

      if (therapistProfile.session_mode) {
        const rawMode = therapistProfile.session_mode.trim().toLowerCase();
        let modes: string[] = [];
        if (rawMode === "both") {
          modes = ["Online", "In-Person"];
        } else {
          modes = rawMode.split(",").map((m: string) => {
            const trimmed = m.trim().toLowerCase();
            if (trimmed === "online") return "Online";
            if (trimmed === "in_person") return "In-Person";
            return m;
          });
        }
        setSelectedModes(modes);
        setSelectSession(true);
      }

      if (Array.isArray(therapistProfile.therapist_certificates)) {
        const certs = therapistProfile.therapist_certificates.map(
          (cert: any) => ({
            id: cert.id,
            certificationName:
              cert.certificate_name ||
              (cert.certificate_path
                ? cert.certificate_path.substring(
                    cert.certificate_path.lastIndexOf("/") + 1
                  )
                : "Uploaded Document"),
            issuingOrganization: "Uploaded Document",
            verificationStatus: "Verified",
            path: cert.certificate_path,
          })
        );
        setCertifications(certs);
      } else {
        setCertifications([]);
      }

      setClinicNameInput(therapistProfile.clinic_name || "");
      setClinicAddressInput(therapistProfile.clinic_address || "");
      setClinicLatitude(therapistProfile.clinic_latitude || "");
      setClinicLongitude(therapistProfile.clinic_longitude || "");
      setSelectedTax(
        therapistProfile.tax_percentage
          ? Number(therapistProfile.tax_percentage)
          : 7
      );
    }
  }, [therapistProfile]);

  // Fetch availability for current month
  const fetchAvailability = async (date: Date) => {
    try {
      const yearStr = date.getFullYear();
      const monthStr = String(date.getMonth() + 1).padStart(2, "0");
      const yearMonth = `${yearStr}-${monthStr}`;

      const response = await requestApi({
        endpoint: "get-therapist-availability",
        method: "POST",
        data: { year_month: yearMonth },
      });

      if (response.success && response.data) {
        setHolidays(response.data.holidays || []);
        setMonthlyAvailability(response.data.availability || []);
        const ranges = groupDatesToRanges(response.data.holidays || []);
        setHolidayList(ranges);
      }
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    }
  };

  useEffect(() => {
    fetchAvailability(currentDate);
  }, [currentDate]);

  // Sync selected date's slots
  useEffect(() => {
    const dateStr = formatDateToYMD(selectedDate);
    const dayAvailability = monthlyAvailability.find(
      (a: any) => a.date === dateStr
    );
    if (
      dayAvailability &&
      dayAvailability.slots &&
      dayAvailability.slots.length > 0
    ) {
      const formattedSlots = dayAvailability.slots.map((s: any) => {
        const start = s.start_time.substring(0, 5);
        const end = s.end_time.substring(0, 5);
        return { start_time: start, end_time: end };
      });
      setSlots(formattedSlots);
    } else {
      setSlots([{ start_time: "", end_time: "" }]);
    }
  }, [selectedDate, monthlyAvailability]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleEditSave = async () => {
    if (isEditing) {
      try {
        toast.loading("Saving changes...", { toastId: "update-personal" });
        const formData = new FormData();
        formData.append("full_name", profileData.fullName);
        formData.append("surname_one", profileData.surname1);
        formData.append("surname_two", profileData.surname2);
        formData.append("phone", profileData.contactNumber);
        formData.append("email", profileData.email);
        formData.append("vat_number", profileData.vatNumber);
        formData.append("street_number_floor", profileData.streetAddress);
        formData.append("city", profileData.city);
        formData.append("province", profileData.province);
        formData.append("country", profileData.country);
        formData.append("postal_code", profileData.postalCode);
        formData.append("years_of_experience", profileData.experience);
        formData.append("proffessional_bio", profileData.bio);

        if (selectedAvatarFile) {
          formData.append("profile_image", selectedAvatarFile);
        }

        const response = await requestApi({
          endpoint: "update-personal-info",
          method: "POST",
          data: formData,
          isFormData: true,
        });

        toast.dismiss("update-personal");
        if (response && response.success === true) {
          toast.success("Profile updated successfully!");
          if (response.data) {
            saveTherapistProfile(response.data);
          }
        } else {
          toast.error(
            getApiErrorMessage(response, "Failed to update profile information")
          );
        }
      } catch (err: any) {
        toast.dismiss("update-personal");
        console.error("Failed to update profile:", err);
        toast.error(
          err.response?.data?.message ||
            err.message ||
            "Failed to update profile"
        );
      }
    }

    setIsEditing(!isEditing);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      setSelectedAvatarFile(file);
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
    }
  };

  const addSlot = () => {
    setSlots([
      ...slots,
      {
        start_time: "",
        end_time: "",
      },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSaveAvailability = async () => {
    const validSlots = slots.filter((s) => s.start_time && s.end_time);
    if (validSlots.length === 0) {
      toast.error(
        "Please add at least one valid slot with start and end times."
      );
      return;
    }

    const formattedSlots = validSlots.map((s) => ({
      start_time: convert24To12(s.start_time),
      end_time: convert24To12(s.end_time),
    }));

    let targetDates: Date[] = [selectedDate];

    if (saveForDay) {
      const weekday = selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
      });
      targetDates = getDatesForWeekdayInMonth(year, month, weekday);
    }

    // Filter out any date that is marked as a holiday
    const filteredDates = targetDates.filter((d) => {
      const dateStr = formatDateToYMD(d);
      return !holidays.includes(dateStr);
    });

    if (filteredDates.length === 0) {
      toast.error("All selected dates are holidays. Cannot save availability.");
      return;
    }

    const availabilityPayload = filteredDates.map((d) => ({
      date: formatDateToYMD(d),
      slots: formattedSlots,
    }));

    try {
      toast.loading("Saving availability...", { toastId: "save-avail" });
      const response = await requestApi({
        endpoint: "save-availability",
        method: "POST",
        data: { availability: availabilityPayload },
      });

      toast.dismiss("save-avail");
      if (response && response.success === true) {
        toast.success("Availability saved successfully!");
        fetchAvailability(currentDate);
        setSaveForDate(false);
        setSaveForDay(false);
      } else {
        toast.error(
          getApiErrorMessage(response, "Failed to save availability")
        );
      }
    } catch (err: any) {
      toast.dismiss("save-avail");
      console.error("Failed to save availability:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to save availability"
      );
    }
  };

  const handleModeToggle = (mode: string) => {
    setSelectedModes((prev) =>
      prev.includes(mode)
        ? prev.filter((item) => item !== mode)
        : [...prev, mode]
    );
  };

  // const handleCertificateFormSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();

  //   if (!certFile) {
  //     toast.error("Please select a file to upload");
  //     return;
  //   }
  //   if (!certName.trim()) {
  //     toast.error("Please enter a certificate name");
  //     return;
  //   }

  //   try {
  //     toast.loading("Uploading certificate...", { toastId: "upload-cert" });
  //     const formData = new FormData();

  //     formData.append("certificates", certFile);
  //     formData.append("certificates_name", certName.trim());

  //     // Replace the URL with your base URL/config if necessary
  //     const res = await axios.post(
  //       `${API_BASE_URL}upload-certificates`,
  //       formData,
  //       {
  //         headers: {
  //           "Content-Type": "multipart/form-data",
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );

  //     const response = res.data;

  //     toast.dismiss("upload-cert");
  //     if (response && response.success) {
  //       toast.success("Certificate uploaded successfully!");
  //       if (response.data) {
  //         saveTherapistProfile(response.data);
  //       }
  //       setShowCertModal(false);
  //       setCertName("");
  //       setCertFile(null);
  //     } else {
  //       let errMsg = response?.message || "Failed to upload certificate";
  //       if (response?.data && typeof response.data === "object") {
  //         const errList: string[] = [];
  //         Object.values(response.data).forEach((val: any) => {
  //           if (Array.isArray(val)) {
  //             errList.push(...val);
  //           } else if (typeof val === "string") {
  //             errList.push(val);
  //           }
  //         });
  //         if (errList.length > 0) {
  //           errMsg = errList.join(" ");
  //         }
  //       }
  //       toast.error(errMsg);
  //     }
  //   } catch (err: any) {
  //     toast.dismiss("upload-cert");
  //     console.error("Failed to upload certificate:", err);
  //     let errMsg =
  //       err.response?.data?.message ||
  //       err.message ||
  //       "Failed to upload certificate";
  //     if (
  //       err.response?.data?.data &&
  //       typeof err.response.data.data === "object"
  //     ) {
  //       const errList: string[] = [];
  //       Object.values(err.response.data.data).forEach((val: any) => {
  //         if (Array.isArray(val)) {
  //           errList.push(...val);
  //         } else if (typeof val === "string") {
  //           errList.push(val);
  //         }
  //       });
  //       if (errList.length > 0) {
  //         errMsg = errList.join(" ");
  //       }
  //     }
  //     toast.error(errMsg);
  //   }
  // };
  const handleCertificateFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!certFile) {
      toast.error("Please select a file to upload");
      return;
    }
    if (!certName.trim()) {
      toast.error("Please enter a certificate name");
      return;
    }

    try {
      toast.loading("Uploading certificate...", { toastId: "upload-cert" });
      const formData = new FormData();
      formData.append("certificates", certFile);
      formData.append("certificates_name", certName.trim());

      // Just pass endpoint and the formData body
      const response = await uploadMedia("upload-certificates", formData);

      toast.dismiss("upload-cert");
      if (response && response.success) {
        toast.success("Certificate uploaded successfully!");
        if (response.data) {
          saveTherapistProfile(response.data);
        }
        setShowCertModal(false);
        setCertName("");
        setCertFile(null);
      } else {
        let errMsg = response?.message || "Failed to upload certificate";
        if (response?.data && typeof response.data === "object") {
          const errList: string[] = [];
          Object.values(response.data).forEach((val: any) => {
            if (Array.isArray(val)) {
              errList.push(...val);
            } else if (typeof val === "string") {
              errList.push(val);
            }
          });
          if (errList.length > 0) {
            errMsg = errList.join(" ");
          }
        }
        toast.error(errMsg);
      }
    } catch (err: any) {
      toast.dismiss("upload-cert");
      console.error("Failed to upload certificate:", err);
      let errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to upload certificate";
      if (
        err.response?.data?.data &&
        typeof err.response.data.data === "object"
      ) {
        const errList: string[] = [];
        Object.values(err.response.data.data).forEach((val: any) => {
          if (Array.isArray(val)) {
            errList.push(...val);
          } else if (typeof val === "string") {
            errList.push(val);
          }
        });
        if (errList.length > 0) {
          errMsg = errList.join(" ");
        }
      }
      toast.error(errMsg);
    }
  };

  const handleDeleteCertificate = async (item: any) => {
    const certId = typeof item === "object" ? item?.id : item;
    if (!certId) return;

    try {
      toast.loading("Deleting certificate...", { toastId: "delete-cert" });
      const response = await requestApi({
        endpoint: "delete-therapist-certificate",
        method: "POST",
        data: { certificate_id: certId },
      });

      toast.dismiss("delete-cert");
      if (response && response.success === true) {
        toast.success("Certificate deleted successfully!");
        if (response.data) {
          saveTherapistProfile(response.data);
        } else {
          setCertifications((prev) => prev.filter((c) => c.id !== certId));
        }
      } else {
        toast.error(
          getApiErrorMessage(response, "Failed to delete certificate")
        );
      }
    } catch (err: any) {
      toast.dismiss("delete-cert");
      console.error("Failed to delete certificate:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to delete certificate"
      );
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStreetSearch = (query: string) => {
    if (streetTimeoutRef.current) {
      clearTimeout(streetTimeoutRef.current);
    }

    if (!query.trim()) {
      setStreetSuggestions([]);
      return;
    }

    streetTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=5`
        );

        const data = await response.json();

        setStreetSuggestions(data);
      } catch (error) {
        console.log(error);
      }
    }, 500);
  };

  const handleSelectStreet = (item: any) => {
    const updated = {
      streetAddress: item.display_name,
      city:
        item.address?.city || item.address?.town || item.address?.village || "",
      postalCode: item.address?.postcode || "",
      province: item.address?.state || "",
      country: item.address?.country || "",
    };

    setProfileData((prev) => ({
      ...prev,
      ...updated,
    }));

    setStreetSuggestions([]);
  };

  const syncHolidays = async (updatedList: DateRange[]) => {
    try {
      toast.loading("Saving holidays...", { toastId: "save-holiday" });
      const payload = {
        holiday: updatedList
          .map((h) => ({
            from: formatDateToYMD(h.startDate),
            to: formatDateToYMD(h.endDate),
          }))
          .filter((h) => h.from && h.to),
      };

      const response = await requestApi({
        endpoint: "save-holiday",
        method: "POST",
        data: payload,
      });

      toast.dismiss("save-holiday");
      if (response && response.success === true) {
        toast.success("Holidays updated successfully!");
        fetchAvailability(currentDate);
      } else {
        toast.error(getApiErrorMessage(response, "Failed to save holidays"));
      }
    } catch (err: any) {
      toast.dismiss("save-holiday");
      console.error("Failed to save holidays:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to save holidays"
      );
    }
  };

  const handleMarkHoliday = () => {
    if (!holidayRange.startDate || !holidayRange.endDate) {
      toast.error("Please select holiday date range");
      return;
    }

    const merged = mergeOverlappingRanges([...holidayList, holidayRange]);
    setHolidayList(merged);
    setHolidayRange({
      startDate: null,
      endDate: null,
    });

    syncHolidays(merged);
  };

  const removeHoliday = (index: number) => {
    const updated = holidayList.filter((_, i) => i !== index);
    setHolidayList(updated);
    syncHolidays(updated);
  };

  const formatHolidayDate = (date: Date | null) => {
    if (!date) return "";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getSessionModeParam = (modes: string[]) => {
    const hasOnline = modes.includes("Online");
    const hasInPerson = modes.includes("In-Person");
    if (hasOnline && hasInPerson) return "both";
    if (hasOnline) return "online";
    if (hasInPerson) return "in_person";
    return "";
  };

  const handleSaveCategoryAndClinic = async () => {
    try {
      toast.loading("Saving category and clinic address...", {
        toastId: "save-category-clinic",
      });
      const formData = new FormData();
      const mode = getSessionModeParam(selectedModes);
      formData.append("session_mode", mode);
      formData.append("clinic_name", clinicNameInput);
      formData.append("clinic_address", clinicAddressInput);
      formData.append("clinic_latitude", String(clinicLatitude));
      formData.append("clinic_longitude", String(clinicLongitude));

      const response = await requestApi({
        endpoint: "update-category-and-clinic-address",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      toast.dismiss("save-category-clinic");
      if (response && response.success === true) {
        toast.success("Category and clinic address updated successfully!");
        if (response.data) {
          saveTherapistProfile(response.data);
        }
        setSelectSession(false);
      } else {
        toast.error(
          getApiErrorMessage(
            response,
            "Failed to update category and clinic address"
          )
        );
      }
    } catch (err: any) {
      toast.dismiss("save-category-clinic");
      console.error("Failed to update category and clinic address:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update category and clinic address"
      );
    }
  };

  const handleUpdateSpecialization = async (ids: number[]) => {
    try {
      toast.loading("Updating specializations...", { toastId: "update-spec" });
      const formData = new FormData();
      formData.append("specialization", ids.join(","));

      const response = await requestApi({
        endpoint: "update-specialization",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      toast.dismiss("update-spec");
      if (response && response.success === true) {
        toast.success("Specializations updated successfully!");
        if (response.data) {
          saveTherapistProfile(response.data);
        }
      } else {
        toast.error(
          getApiErrorMessage(response, "Failed to update specializations")
        );
      }
    } catch (err: any) {
      toast.dismiss("update-spec");
      console.error("Failed to update specializations:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update specializations"
      );
    }
  };

  const handleAddNewSpecialization = async (name: string) => {
    try {
      toast.loading("Adding specialization...", { toastId: "add-spec" });
      const formData = new FormData();
      formData.append("specialization", name);

      const response = await requestApi({
        endpoint: "add-specialization",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      toast.dismiss("add-spec");
      if (response && response.success === true) {
        toast.success("Specialization added successfully!");
        const specsRes = await requestApi({
          endpoint: "get-all-specialization",
          method: "POST",
        });
        let specs: any[] = [];
        if (specsRes) {
          if (Array.isArray(specsRes)) {
            specs = specsRes;
          } else if (specsRes.data) {
            if (Array.isArray(specsRes.data)) {
              specs = specsRes.data;
            } else if (Array.isArray(specsRes.data.specializations)) {
              specs = specsRes.data.specializations;
            }
          }
        }
        setSpecializationOptions(specs);
      } else {
        toast.error(response.message || "Failed to add specialization");
      }
    } catch (err: any) {
      toast.dismiss("add-spec");
      console.error("Failed to add specialization:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to add specialization"
      );
    }
  };

  const handleUpdateConsultationReasons = async (ids: number[]) => {
    try {
      toast.loading("Updating reasons of consultation...", {
        toastId: "update-reasons",
      });
      const formData = new FormData();
      formData.append("reason_of_consultation", ids.join(","));

      const response = await requestApi({
        endpoint: "update-reason-of-consultation",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      toast.dismiss("update-reasons");
      if (response && response.success === true) {
        toast.success("Reasons of consultation updated successfully!");
        if (response.data) {
          saveTherapistProfile(response.data);
        }
      } else {
        toast.error(
          getApiErrorMessage(
            response,
            "Failed to update reasons of consultation"
          )
        );
      }
    } catch (err: any) {
      toast.dismiss("update-reasons");
      console.error("Failed to update reasons of consultation:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update reasons of consultation"
      );
    }
  };

  const handleUpdateTaxPercentage = async (taxVal: number) => {
    try {
      toast.loading("Updating tax percentage...", { toastId: "update-tax" });
      const formData = new FormData();
      formData.append("tax_percentage", String(taxVal));

      const response = await requestApi({
        endpoint: "update-tax-percentage",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      toast.dismiss("update-tax");
      if (response && response.success === true) {
        toast.success("Tax percentage updated successfully!");
        if (response.data) {
          saveTherapistProfile(response.data);
        }
        setIsEditingTax(false);
      } else {
        toast.error(
          getApiErrorMessage(response, "Failed to update tax percentage")
        );
      }
    } catch (err: any) {
      toast.dismiss("update-tax");
      console.error("Failed to update tax percentage:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update tax percentage"
      );
    }
  };

  return (
    <>
      <main className="gl-content-body">
        <div className="onyba-prof-page-wrapper">
          <div className="onyba-prof-main-col">
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/personal-profile-icon.svg" alt="" />
                  </span>
                  <h2>Personal Profile</h2>
                </div>
                <button
                  className="onyba-prof-btn-action"
                  onClick={handleEditSave}
                >
                  {isEditing ? " Save Changes" : "Edit Profile"}
                </button>
              </div>

              <div className="onyba-prof-user-card">
                <div className="onyba-prof-avatar-wrap">
                  <img
                    src={profileImage}
                    alt="Profile Avatar"
                    className="onyba-prof-avatar-img"
                  />
                  <label
                    htmlFor="onyba-prof-avatar-upload"
                    className="onyba-prof-upload-icon"
                  >
                    <img src="images/upload-file-icon.svg" alt="Upload" />
                    <input
                      type="file"
                      id="onyba-prof-avatar-upload"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                <div className="onyba-prof-user-details">
                  <h3>{profileData.fullName}</h3>
                  <p className="onyba-prof-user-subtitle">
                    {(() => {
                      if (therapistProfile?.description) {
                        const desc = therapistProfile.description;
                        return desc.length > 45
                          ? desc.substring(0, 42) + "..."
                          : desc;
                      }
                      return "Clinical Psychologist . RCI Registered";
                    })()}
                  </p>
                  <div className="onyba-prof-badge-row">
                    <span className="onyba-prof-badge onyba-prof-badge--exp">
                      {profileData.experience} Years Exp.
                    </span>
                    <span className="onyba-prof-badge onyba-prof-badge--status">
                      Available
                    </span>
                  </div>
                </div>
              </div>

              <div className="onyba-prof-form-inline-row">
                <div className="onyba-prof-field-box onyba-prof-w-50">
                  <label>Full Name*</label>
                  <input
                    type="text"
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="onyba-prof-field-box onyba-prof-w-25">
                  <label>Surname 1*</label>
                  <input
                    type="text"
                    name="surname1"
                    value={profileData.surname1}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="onyba-prof-field-box onyba-prof-w-25">
                  <label>Surname 2 (Optional)</label>
                  <input
                    type="text"
                    name="surname2"
                    value={profileData.surname2}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="onyba-prof-form-inline-row">
                <div className="onyba-prof-field-box onyba-prof-w-33">
                  <label>Contact Number*</label>
                  <input
                    type="text"
                    name="contactNumber"
                    value={profileData.contactNumber}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="onyba-prof-field-box onyba-prof-w-33">
                  <label>Email*</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="onyba-prof-field-box onyba-prof-w-33">
                  <label>VAT Number*</label>
                  <input
                    type="text"
                    name="vatNumber"
                    value={profileData.vatNumber}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="onyba-prof-field-box onyba-prof-w-100">
                <label>Street-number-floor*</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    name="streetAddress"
                    value={profileData.streetAddress}
                    disabled={!isEditing}
                    onChange={(e) => {
                      handleChange(e);
                      if (isEditing) {
                        handleStreetSearch(e.target.value);
                      }
                    }}
                    autoComplete="off"
                  />

                  {streetSuggestions.length > 0 && (
                    <div
                      className="tp-dropdown-menu"
                      style={{
                        display: "block",
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "100%",
                        zIndex: 8,
                        maxHeight: "220px",
                        overflowY: "auto",
                        background: "#fff",
                        border: "1px solid #ddd",
                      }}
                    >
                      {streetSuggestions.map((item, index) => (
                        <div
                          key={index}
                          className="tp-dropdown-item"
                          style={{
                            padding: "10px",
                            cursor: "pointer",
                            borderBottom: "1px solid #eee",
                          }}
                          onClick={() => handleSelectStreet(item)}
                        >
                          {item.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="onyba-prof-form-inline-row">
                <div className="onyba-prof-field-box onyba-prof-w-50">
                  <label>City*</label>
                  <input
                    type="text"
                    name="city"
                    value={profileData.city}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="onyba-prof-field-box onyba-prof-w-50">
                  <label>Postal Code*</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={profileData.postalCode}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="onyba-prof-form-inline-row">
                <div className="onyba-prof-field-box onyba-prof-w-50">
                  <label>Province*</label>
                  <input
                    type="text"
                    name="province"
                    value={profileData.province}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="onyba-prof-field-box onyba-prof-w-50">
                  <label>Country*</label>
                  <input
                    type="text"
                    name="country"
                    value={profileData.country}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="onyba-prof-field-box onyba-prof-w-100">
                <label>Years of Experience</label>
                <input
                  type="text"
                  name="experience"
                  value={profileData.experience}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>

              <div className="onyba-prof-field-box onyba-prof-w-100">
                <label>Professional Bio</label>
                <textarea
                  rows={4}
                  name="bio"
                  value={profileData.bio}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>{" "}
            <hr className="onyba-prof-separator" />
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/certificate-icon.svg" alt="" />
                  </span>
                  <h2>Certifications</h2>
                </div>
                <button
                  className="onyba-prof-btn-action"
                  onClick={() => setShowCertModal(true)}
                >
                  Upload
                </button>
              </div>

              <div className="onyba-prof-cert-stack">
                {certifications.map((item) => (
                  <div className="onyba-prof-cert-card" key={item.id}>
                    <div>
                      <h4>{item.certificationName}</h4>
                      <p>{item.issuingOrganization}</p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span className="onyba-prof-status-tag">
                        {item.verificationStatus}
                      </span>
                      <button
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: "20px",
                          color: "#ff5a5a",
                          cursor: "pointer",
                          padding: "4px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onClick={() => handleDeleteCertificate(item)}
                        title="Delete Certificate"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>{" "}
          </div>

          <div className="onyba-prof-side-col">
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/category-selection.svg" alt="" />
                  </span>
                  <h2>Category Selection</h2>
                </div>
                <button
                  className="onyba-prof-btn-action"
                  onClick={() => setSelectSession(!selectSession)}
                >
                  {selectSession
                    ? "Cancel"
                    : therapistProfile?.session_mode
                    ? "Edit"
                    : "Add"}
                </button>
              </div>

              {selectSession ? (
                <>
                  <p className="onyba-prof-sub-title-text">
                    Select session mode
                  </p>
                  <div
                    className="onyba-prof-mode-toggle-row"
                    style={{ marginBottom: "15px" }}
                  >
                    <button
                      className={`onyba-prof-btn-mode ${
                        selectedModes.includes("Online")
                          ? "onyba-prof-btn-mode--active"
                          : "onyba-prof-btn-mode--inactive"
                      }`}
                      onClick={() => handleModeToggle("Online")}
                    >
                      <img src="images/online-icon.svg" alt="" />
                      Online
                    </button>
                    <button
                      className={`onyba-prof-btn-mode ${
                        selectedModes.includes("In-Person")
                          ? "onyba-prof-btn-mode--active"
                          : "onyba-prof-btn-mode--inactive"
                      }`}
                      onClick={() => handleModeToggle("In-Person")}
                    >
                      <img src="images/hugeicons_location-05.svg" alt="" />{" "}
                      In-Person
                    </button>
                  </div>

                  <p className="onyba-prof-sub-title-text">Clinic name</p>
                  <div style={{ position: "relative", marginBottom: "15px" }}>
                    <input
                      type="text"
                      value={clinicNameInput}
                      onChange={(e) => setClinicNameInput(e.target.value)}
                      placeholder="Enter clinic name"
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        color: "#000",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <p className="onyba-prof-sub-title-text">Clinic address</p>
                  <div style={{ position: "relative", marginBottom: "15px" }}>
                    <Autocomplete
                      apiKey="AIzaSyDcDl4RoLc2oLDDpkJqdhWOWHP0B4qBEqk"
                      onPlaceSelected={(place) => {
                        const address =
                          place.formatted_address || place.name || "";
                        const lat = place.geometry?.location?.lat();
                        const lng = place.geometry?.location?.lng();
                        setClinicAddressInput(address);
                        setClinicLatitude(lat ? String(lat) : "");
                        setClinicLongitude(lng ? String(lng) : "");
                      }}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        color: "#000",
                        fontSize: "14px",
                      }}
                      placeholder="Enter clinic address"
                      defaultValue={clinicAddressInput}
                      onChange={(e: any) => {
                        setClinicAddressInput(e.target.value);
                      }}
                    />
                  </div>

                  <div style={{ marginTop: "15px" }}>
                    <button
                      className="onyba-prof-btn-action"
                      style={{ width: "100%" }}
                      onClick={handleSaveCategoryAndClinic}
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="onyba-prof-mode-toggle-row">
                    {selectedModes.map((m) => (
                      <span
                        key={m}
                        className="onyba-prof-chip"
                        style={{
                          background: "#f5f5f5",
                          color: "#333",
                          padding: "6px 12px",
                          borderRadius: "16px",
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>

                  {(therapistProfile?.clinic_name || clinicNameInput) && (
                    <>
                      <p
                        className="onyba-prof-sub-title-text"
                        style={{ marginTop: "15px" }}
                      >
                        Clinic Name
                      </p>
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#333",
                          marginTop: "4px",
                          marginBottom: "10px",
                        }}
                      >
                        {therapistProfile?.clinic_name || clinicNameInput}
                      </p>
                    </>
                  )}

                  <p
                    className="onyba-prof-sub-title-text"
                    style={{
                      marginTop:
                        therapistProfile?.clinic_name || clinicNameInput
                          ? "10px"
                          : "15px",
                    }}
                  >
                    Clinic Address
                  </p>
                  <div className="onyba-prof-address-card">
                    <span className="onyba-prof-pin">
                      <img src="images/location-profile-icon.svg" alt="" />
                    </span>
                    <p>
                      {therapistProfile?.clinic_address ||
                        clinicAddressInput ||
                        "No clinic address set"}
                    </p>
                  </div>
                </>
              )}
            </div>{" "}
            <hr className="onyba-prof-separator" />
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/star-icons.svg" alt="" />
                  </span>
                  <h2>Specializations</h2>
                </div>
                <button
                  data-bs-toggle="modal"
                  data-bs-target="#specializationModal"
                  className="onyba-prof-btn-action"
                >
                  Add
                </button>
              </div>

              <div className="onyba-prof-tag-cloud">
                {therapistProfile?.specialization_id ? (
                  therapistProfile.specialization_id
                    .split(",")
                    .map((idStr: string) => {
                      const id = parseInt(idStr.trim(), 10);
                      const name = specializationOptions.find(
                        (o: any) => Number(o.id) === id
                      )?.name;
                      return name ? (
                        <span key={id} className="onyba-prof-chip">
                          {name}
                        </span>
                      ) : null;
                    })
                ) : (
                  <span className="text-muted">
                    No specializations selected
                  </span>
                )}
              </div>
            </div>{" "}
            <hr className="onyba-prof-separator" />
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/star-icons.svg" alt="" />
                  </span>
                  <h2>Reason for Consultation</h2>
                </div>
                <button
                  data-bs-toggle="modal"
                  data-bs-target="#reasonConsultation"
                  className="onyba-prof-btn-action"
                >
                  Add
                </button>
              </div>

              <div className="onyba-prof-tag-cloud">
                {therapistProfile?.reason_of_consultation_id ? (
                  therapistProfile.reason_of_consultation_id
                    .split(",")
                    .map((idStr: string) => {
                      const id = parseInt(idStr.trim(), 10);
                      const name = consultationOptions.find(
                        (o: any) => Number(o.id) === id
                      )?.name;
                      return name ? (
                        <span key={id} className="onyba-prof-chip">
                          {name}
                        </span>
                      ) : null;
                    })
                ) : (
                  <span className="text-muted">No reasons selected</span>
                )}
              </div>
            </div>{" "}
            <hr className="onyba-prof-separator" />
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/file-load-icon.svg" alt="" />
                  </span>
                  <h2>Tax Edit</h2>
                </div>
                <button
                  className="onyba-prof-btn-action"
                  onClick={async () => {
                    if (isEditingTax) {
                      await handleUpdateTaxPercentage(selectedTax);
                    } else {
                      setIsEditingTax(true);
                    }
                  }}
                >
                  {isEditingTax ? "Save" : "Edit"}
                </button>
              </div>

              <div className="onyba-prof-tax-bar">
                <span className="onyba-prof-tax-text">Tax Bracket</span>
                <div className="onyba-prof-tax-options-wrap">
                  {[7, 10, 15].map((taxVal) => (
                    <span
                      key={taxVal}
                      className={`onyba-prof-tax-item ${
                        selectedTax === taxVal
                          ? "onyba-prof-tax-item--active"
                          : ""
                      }`}
                      style={{ cursor: isEditingTax ? "pointer" : "default" }}
                      onClick={() => {
                        if (isEditingTax) {
                          setSelectedTax(taxVal);
                        }
                      }}
                    >
                      {taxVal}%
                    </span>
                  ))}
                </div>
              </div>
            </div>{" "}
            <hr className="onyba-prof-separator" />
            <div className="onyba-prof-section-container">
              <div className="onyba-prof-section-header">
                <div className="onyba-prof-header-title-box">
                  <span className="onyba-prof-icon-badge">
                    <img src="images/file-load-icon.svg" alt="" />
                  </span>
                  <h2>Contact Admin</h2>
                </div>
              </div>

              <div className="onyba-prof-admin-bar">
                <span>Email Address</span>
                <a
                  href="mailto:admin@onyba.com"
                  className="onyba-prof-admin-email-pill"
                >
                  admin@onyba.com
                </a>
              </div>
            </div>{" "}
          </div>
        </div>

        <div className="onyba-avail-page-wrapper">
          <div className="onyba-avail-header-container">
            <div className="onyba-avail-title-box">
              <span className="onyba-avail-icon-circle">
                <img src="images/clock-avl-icon.svg" alt="" />
              </span>
              <h2>Availability Management</h2>
            </div>
          </div>

          <div className="onyba-avail-content-body">
            <div className="onyba-avail-calendar-section">
              <div className="onyba-avail-month-nav">
                <span className="onyba-avail-month-title">
                  {currentDate.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <div className="onyba-avail-nav-arrows">
                  <button
                    className="onyba-avail-arrow-btn"
                    onClick={handlePrevMonth}
                  >
                    &#10094;
                  </button>
                  <button
                    className="onyba-avail-arrow-btn"
                    onClick={handleNextMonth}
                  >
                    &#10095;
                  </button>
                </div>
              </div>

              <div className="onyba-avail-weekdays-row">
                <div className="onyba-avail-day-label">SUN</div>
                <div className="onyba-avail-day-label">MON</div>
                <div className="onyba-avail-day-label">TUE</div>
                <div className="onyba-avail-day-label">WED</div>
                <div className="onyba-avail-day-label">THU</div>
                <div className="onyba-avail-day-label">FRI</div>
                <div className="onyba-avail-day-label">SAT</div>
              </div>

              <div className="onyba-avail-days-stack">
                {Array.from({
                  length: Math.ceil(calendarDays.length / 7),
                }).map((_, rowIndex) => (
                  <div key={rowIndex} className="onyba-avail-days-row">
                    {calendarDays
                      .slice(rowIndex * 7, rowIndex * 7 + 7)
                      .map((day, index) => {
                        const dateStr = day
                          ? `${year}-${String(month + 1).padStart(
                              2,
                              "0"
                            )}-${String(day).padStart(2, "0")}`
                          : "";

                        const isHoliday = day && holidays.includes(dateStr);

                        const today = new Date();

                        const isToday =
                          day &&
                          day === today.getDate() &&
                          month === today.getMonth() &&
                          year === today.getFullYear();

                        const isSelected =
                          day &&
                          day === selectedDate.getDate() &&
                          month === selectedDate.getMonth() &&
                          year === selectedDate.getFullYear();

                        return (
                          <div
                            key={index}
                            className={`onyba-avail-date-cell
                                                            ${
                                                              !day
                                                                ? "onyba-avail-date-empty"
                                                                : ""
                                                            }
                                                            ${
                                                              isToday
                                                                ? "onyba-avail-date--today"
                                                                : ""
                                                            }
                                                            ${
                                                              isSelected
                                                                ? "onyba-avail-date--selected"
                                                                : ""
                                                            }
                                                            ${
                                                              isHoliday
                                                                ? "onyba-avail-date--holiday"
                                                                : ""
                                                            }
                                                        `}
                            onClick={() => {
                              if (!day || isHoliday) return;
                              setSelectedDate(new Date(year, month, day));
                            }}
                          >
                            {day}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>

            <div className="onyba-avail-slots-section">
              <div
                style={{
                  color: "#1A1A1A",
                  fontWeight: "600",
                  fontSize: "16px",
                  marginBottom: "18px",
                }}
              >
                <div className="holiday-wrapper">
                  <label className="holiday-checkbox">
                    <input type="checkbox" />
                    <span>Mark as Holiday or Unavailability</span>
                  </label>

                  <h4>Holiday Date Range</h4>

                  <DateRangePicker
                    value={holidayRange}
                    onChange={setHolidayRange}
                  >
                    <div className="holiday-date-box">
                      <div className="holiday-date-field">
                        <label>From</label>

                        <div className="holiday-input">
                          <span>
                            {holidayRange.startDate
                              ? formatHolidayDate(holidayRange.startDate)
                              : "Select date"}
                          </span>

                          <img src="/images/date-icon-small.svg" alt="" />
                        </div>
                      </div>

                      <div className="holiday-date-field">
                        <label>To</label>

                        <div className="holiday-input">
                          <span>
                            {holidayRange.endDate
                              ? formatHolidayDate(holidayRange.endDate)
                              : "Select date"}
                          </span>

                          <img src="/images/date-icon-small.svg" alt="" />
                        </div>
                      </div>
                    </div>
                  </DateRangePicker>

                  <button
                    className="onyba-avail-btn-block-submit mt-3"
                    onClick={handleMarkHoliday}
                  >
                    Mark Selected Range as Holiday
                  </button>

                  {holidayList.length > 0 && (
                    <>
                      <h4 className="holiday-title">Holiday List</h4>

                      <div className="holiday-list">
                        {holidayList.map((item, index) => (
                          <div key={index} className="holiday-item">
                            <span>{formatHolidayDate(item.startDate)}</span>

                            <span>→</span>

                            <span>{formatHolidayDate(item.endDate)}</span>

                            <button onClick={() => removeHoliday(index)}>
                              <ImBin style={{ color: "red" }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <h3 className="onyba-avail-section-title">
                Available Time Slots
              </h3>
              <p
                className="onyba-avail-selected-day-text"
                id="onyba-selected-date-label"
              >
                {selectedDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </p>

              <div
                className="onyba-avail-slots-vertical-list"
                id="onyba-slots-container"
              >
                {slots.map((slot, index) => (
                  <div
                    className="onyba-avail-slot-item-row"
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      className="onyba-avail-input-time-wrap"
                      style={{ flex: 1 }}
                    >
                      <input
                        type="time"
                        className="onyba-avail-time-field"
                        style={{ width: "100%", padding: "12px 16px" }}
                        value={slot.start_time}
                        onChange={(e) => {
                          const updated = [...slots];
                          updated[index].start_time = e.target.value;
                          setSlots(updated);
                        }}
                      />
                      <span className="onyba-avail-clock-icon">
                        <MdOutlineWatchLater />
                      </span>
                    </div>
                    <span style={{ color: "#666" }}>-</span>
                    <div
                      className="onyba-avail-input-time-wrap"
                      style={{ flex: 1 }}
                    >
                      <input
                        type="time"
                        className="onyba-avail-time-field"
                        style={{ width: "100%", padding: "12px 16px" }}
                        value={slot.end_time}
                        onChange={(e) => {
                          const updated = [...slots];
                          updated[index].end_time = e.target.value;
                          setSlots(updated);
                        }}
                      />
                      <span className="onyba-avail-clock-icon">
                        <MdOutlineWatchLater />
                      </span>
                    </div>

                    {index !== 0 && (
                      <button
                        className="onyba-avail-btn-remove"
                        onClick={() => removeSlot(index)}
                      >
                        &times;
                      </button>
                    )}

                    {index === slots.length - 1 && (
                      <button
                        className="onyba-avail-btn-add-more"
                        onClick={addSlot}
                      >
                        +
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="onyba-avail-footer-actions-row">
                <button
                  className={
                    saveForDate
                      ? "onyba-avail-btn-maroon"
                      : "onyba-avail-btn-secondary"
                  }
                  onClick={() => {
                    setSaveForDate(!saveForDate);
                    if (!saveForDate) setSaveForDay(false);
                  }}
                >
                  Save for{" "}
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                </button>
                <button
                  className={
                    saveForDay
                      ? "onyba-avail-btn-maroon"
                      : "onyba-avail-btn-secondary"
                  }
                  onClick={() => {
                    setSaveForDay(!saveForDay);
                    if (!saveForDay) setSaveForDate(false);
                  }}
                >
                  Save for all{" "}
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                  })}
                </button>
              </div>

              <button
                className="onyba-avail-btn-block-submit"
                onClick={handleSaveAvailability}
              >
                Save Availability
              </button>
            </div>
          </div>
        </div>
      </main>

      <ReasonConsultationPopup
        options={consultationOptions}
        selectedIds={
          therapistProfile?.reason_of_consultation_id
            ? therapistProfile.reason_of_consultation_id
                .split(",")
                .map((id: string) => parseInt(id.trim(), 10))
                .filter((n: number) => !isNaN(n))
            : []
        }
        onApply={handleUpdateConsultationReasons}
      />
      <SpecializationPopup
        options={specializationOptions}
        selectedIds={
          therapistProfile?.specialization_id
            ? therapistProfile.specialization_id
                .split(",")
                .map((id: string) => parseInt(id.trim(), 10))
                .filter((n: number) => !isNaN(n))
            : []
        }
        onApply={handleUpdateSpecialization}
        onAddCustomSpec={handleAddNewSpecialization}
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
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span className="onyba-prof-icon-badge" style={{ margin: 0 }}>
                    <img src="images/certificate-icon.svg" alt="" />
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1a1a1a",
                    }}
                  >
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
                    setCertName("");
                    setCertFile(null);
                  }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCertificateFormSubmit}>
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
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
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
                    Upload File*
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => setCertFile(e.target.files?.[0] || null)}
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
                      setCertName("");
                      setCertFile(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="onyba-prof-btn-action"
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

export default PersonalProfile;
