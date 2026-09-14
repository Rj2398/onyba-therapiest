'use client'

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/src/app/UserProvider';
import { API_BASE_URL } from '@/src/config';
import { useForm } from 'react-hook-form';
import { requestApi } from '@/src/utils/api';


const Login = () => {

    const router = useRouter()
    const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true)
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const [error, setError] = useState<string>("")

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem('loginUser');
            if (stored && stored !== 'undefined' && stored !== 'null') {
                const parsed = JSON.parse(stored);
                const token = parsed?.token || parsed?.user_details?.token;
                if (token && typeof token === 'string' && token.trim() !== '') {
                    router.replace('/dashboard');
                    return;
                } else {
                    window.localStorage.removeItem('loginUser');
                }
            }
        } catch (e) {
            console.error('Auth redirect check failed on Login:', e);
        }
        setIsCheckingAuth(false);
    }, [router]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: {
            emailPhone: ""
        }
    });

    const onSubmit = async (data: any) => {
        const emailPhoneVal = data.emailPhone.trim();
        try {
            setIsSubmitting(true);
            setError("");
            const responseData = await requestApi({
                endpoint: 'login',
                method: 'POST',
                data: {
                    emailPhone: emailPhoneVal,
                    type: 'therapist',
                }
            });

            if (responseData.status === false || responseData.success === false || responseData.error) {
                throw new Error(responseData.message || responseData.error || 'Login request failed');
            }

            router.push(`/otp?emailPhone=${encodeURIComponent(emailPhoneVal)}`);
        } catch (err: any) {
            const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(serverMessage || "Failed to send OTP. Please check your credentials.");
        } finally {
            setIsSubmitting(false);
        }
    }


    if (isCheckingAuth) {
        return null;
    }

    return (
        <>
            <div className="onyba-login-section">

                <div className="onyba-login-wrapper">

                    <div className="onyba-login-left-banner">
                        <div className="onyba-brain-container">
                            <img src="/images/login-left-img.svg" alt="Brain Illustration" className="onyba-brain-img" />
                        </div>
                    </div>

                    <div className="onyba-login-right-content">
                        <div className="onyba-form-card">

                            <div className="onyba-header-logo">
                                <img src="/images/onybasvglogo.svg" alt="Onyba" />

                                {/* <img src="/images/logo..svg" alt="" /> */}
                            </div>

                            <h2 className="onyba-form-title">Therapist Login</h2>
                            <p className="onyba-form-subtitle">Use credentials to access your account</p>

                            <form className="onyba-login-form" onSubmit={handleSubmit(onSubmit)}>
                                <div className="onyba-form-group">
                                    <div className="onyba-input-field-wrapper">
                                        <div className="onyba-icon-circle">
                                            <img src="/images/login-msg-icon.svg" alt="" />
                                        </div>
                                        <input
                                            type="text"
                                            className="onyba-input-control"
                                            placeholder="Phone Number/Email"
                                            {...register("emailPhone", {
                                                required: "Email or phone number is required",
                                                validate: (val: string) => {
                                                    const input = val.trim();
                                                    const phoneRegex = /^\d{10}$/;
                                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                                    if (!phoneRegex.test(input) && !emailRegex.test(input)) {
                                                        return "Please enter a valid email or phone number";
                                                    }
                                                    return true;
                                                },
                                                onChange: () => setError("")
                                            })}
                                        />
                                    </div>

                                    {errors.emailPhone && (
                                        <span style={{ color: "red", marginTop: "10px", marginLeft: "60px", display: "block" }}>
                                            {errors.emailPhone.message?.toString()}
                                        </span>
                                    )}
                                    {error && (
                                        <span style={{ color: "red", marginTop: "10px", marginLeft: "60px", display: "block" }}>
                                            {error}
                                        </span>
                                    )}
                                </div>

                                <button type="submit" className="onyba-submit-btn" disabled={isSubmitting}>
                                    {isSubmitting ? "Sending OTP..." : "Continue"}
                                </button>
                            </form>
                        </div>
                    </div>

                </div>

                <div className="onyba-bg-curve"></div>
            </div>
        </>
    )
}

export default Login
