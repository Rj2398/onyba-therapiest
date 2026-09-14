"use client";

import WelcomeModal from "@/src/component/WelcomeModal";
import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "@/src/app/UserProvider";
import { API_BASE_URL } from "@/src/config";
import { useRouter, useSearchParams } from "next/navigation";
import { requestApi } from "@/src/utils/api";

const OTP_LENGTH = 5;
const RESEND_SECONDS = 30;

const OtpVerification = () => {
  const router = useRouter();
  const { login, therapistProfile, saveTherapistProfile } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const searchParams = useSearchParams();
  const emailPhone = searchParams.get("emailPhone") || "";
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if user is already logged in
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("loginUser");
      if (stored && stored !== "undefined" && stored !== "null") {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          (parsed.token ||
            parsed.user ||
            parsed.id ||
            (typeof parsed === "object" && Object.keys(parsed).length > 0))
        ) {
          router.replace("/dashboard");
        }
      }
    } catch (e) {
      console.error("Auth check on OTP page failed:", e);
    }
  }, [router]);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    // Only allow single digit (0-9)
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    // Focus the last filled input or the next empty one
    const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleResend = async () => {
    if (!canResend || isResending || isVerifying) return;

    if (!emailPhone) {
      setError("No active login session. Please go back and login again.");
      return;
    }

    try {
      setIsResending(true);
      setError("");

      const responseData = await requestApi({
        endpoint: "resend-otp",
        method: "POST",
        data: {
          emailPhone: emailPhone,
          type: "therapist",
        },
      });

      if (
        responseData.status === false ||
        responseData.success === false ||
        responseData.error
      ) {
        throw new Error(
          responseData.message || responseData.error || "Failed to resend OTP"
        );
      }

      setOtp(Array(OTP_LENGTH).fill(""));
      setTimer(RESEND_SECONDS);
      setCanResend(false);
      inputRefs.current[0]?.focus();
      console.log("OTP resent");
    } catch (err: any) {
      const serverMessage =
        err.response?.data?.message || err.response?.data?.error || err.message;
      setError(serverMessage || "Failed to resend OTP. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const otpValue = otp.join("");

    if (otpValue.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    if (!emailPhone) {
      setError("No active login session. Please go back and login again.");
      return;
    }

    try {
      setIsVerifying(true);
      setError("");

      const responseData = await requestApi({
        endpoint: "verify-otp",
        method: "POST",
        data: {
          emailPhone: emailPhone,
          otp: otpValue,
          type: "therapist",
          fcm_token: "sdgdfoighdiufhgjdmg5456dgdfhgefhusdfn",
        },
      });

      if (
        responseData.status === false ||
        responseData.success === false ||
        responseData.error
      ) {
        throw new Error(
          responseData.message ||
          responseData.error ||
          "OTP verification failed"
        );
      }

      console.log(responseData?.data, "data comes here ");

      login(responseData?.data);

      // Fetch therapist profile to determine redirection
      try {
        const profileRes = await requestApi({
          endpoint: "get-therapist-profile",
          method: "POST",
        });
        const therapist = profileRes?.data?.therapist;
        if (therapist) {
          if (Number(therapist.is_profile_completed) === 1) {
            if (therapist.approval_status === "approved") {
              router.push("/dashboard");
              saveTherapistProfile(therapist);
            } else {
              router.push("/profile");
            }
          } else {
            // is_profile_completed === 0: direct redirect to profile
            router.push("/profile");
          }
          return;
        }
      } catch (profileErr) {
        console.error(
          "Failed to fetch therapist profile post-OTP:",
          profileErr
        );
      }
      // Fallback
      router.push("/profile");
    } catch (err: any) {
      const serverMessage =
        err.response?.data?.message || err.response?.data?.error || err.message;
      setError(serverMessage || "OTP verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <div className="onyba-login-section">
        <div className="onyba-login-wrapper">
          <div className="onyba-login-left-banner">
            <div className="onyba-brain-container">
              <img
                src="/images/login-left-img.svg"
                alt="Brain Illustration"
                className="onyba-brain-img"
              />
            </div>
          </div>

          <div className="onyba-login-right-content">
            <div className="onyba-form-card">
              <div className="onyba-header-logo">
                <img src="/images/onybasvglogo.svg" alt="Onyba" />
                {/* <img src="/images/logo..svg" alt="" /> */}
              </div>

              <h2 className="onyba-form-title">Verify Your Account</h2>
              <p className="onyba-form-subtitle">
                We've sent 5-digit code to your email.
              </p>

              <form
                className="onyba-login-form"
                id="otp-form"
                onSubmit={handleContinue}
              >
                <div className="onyba-otp-inputs-row">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      className="onyba-otp-input-box"
                      maxLength={1}
                      placeholder="-"
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                {error && (
                  <p
                    style={{
                      color: "red",
                      fontSize: "13px",
                      marginTop: "6px",
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="onyba-submit-btn"
                  disabled={isVerifying || isResending}
                >
                  {isVerifying ? "Verifying..." : "Verify"}
                </button>

                <div className="onyba-otp-resend-wrapper">
                  {canResend ? (
                    <>
                      Didn't receive code?{" "}
                      {isResending ? (
                        <span className="onyba-resend-text">Resending...</span>
                      ) : (
                        <a
                          href="#"
                          className="onyba-resend-text"
                          onClick={(e) => {
                            e.preventDefault();
                            handleResend();
                          }}
                        >
                          Resend
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      Didn't receive code? Resend verification code in{" "}
                      <span className="onyba-resend-text">{timer}s</span>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="onyba-bg-curve"></div>
      </div>

      <WelcomeModal />
    </>
  );
};

export default OtpVerification;
