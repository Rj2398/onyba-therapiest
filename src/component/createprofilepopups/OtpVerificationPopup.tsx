import React, { useState, useEffect, useRef } from 'react'
import { requestApi } from '@/src/utils/api'
import toast from 'react-hot-toast'

interface OtpVerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  emailPhone: string;
  type: 'email' | 'phone';
  onSuccess: () => void;
}

const OTP_LENGTH = 5;

const OtpVerificationPopup: React.FC<OtpVerificationPopupProps> = ({
  isOpen,
  onClose,
  emailPhone,
  type,
  onSuccess,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timer, setTimer] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setTimer(30);
    // Focus the first input box when modal opens
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timer]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    // Focus the last filled input or the next empty one
    const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < OTP_LENGTH) {
      toast.error(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    try {
      setIsVerifying(true);
      const payload = new FormData();
      payload.append('emailPhone', emailPhone);
      payload.append('otp', otpValue);

      const res = await requestApi({
        endpoint: 'verify-email-phone-otp-therapist',
        method: 'POST',
        data: payload,
        isFormData: true,
      });

      if (res.success || res.status) {
        toast.success(`${type === 'email' ? 'Email' : 'Phone'} verified successfully!`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || 'OTP verification failed.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Error verifying OTP.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || isResending) return;
    try {
      setIsResending(true);
      const payload = new FormData();
      payload.append('emailPhone', emailPhone);

      const res = await requestApi({
        endpoint: 'verify-email-phone-therapist',
        method: 'POST',
        data: payload,
        isFormData: true,
      });

      if (res.success || res.status) {
        toast.success('OTP sent successfully!');
        setTimer(30);
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      } else {
        toast.error(res.message || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Error sending OTP.');
    } finally {
      setIsResending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={`modal fade show`} style={{ display: 'block', zIndex: 1050 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content custom-modal-content" style={{ borderRadius: '24px', border: 'none', padding: '30px' }}>
            <button type="button" className="profile-sub-close-btn" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', position: 'absolute', right: '20px', top: '20px', cursor: 'pointer' }}>
              <img src="/images/close-btn-popup.svg" alt="Close" />
            </button>

            <div className="modal-body text-center p-0">
              <div className="success-icon-box yellow mb-3" style={{ background: 'rgba(116, 80, 92, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#74505C" strokeWidth="2">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>

              <h5 className="modal-custom-title" style={{ fontSize: '22px', fontWeight: '700', color: '#2d3129', marginBottom: '8px' }}>
                Verify Your {type === 'email' ? 'Email' : 'Phone'}
              </h5>

              <p className="modal-custom-text" style={{ fontSize: '14px', color: '#6c757d', marginBottom: '24px', lineHeight: '1.5' }}>
                We've sent a 5-digit verification code to:<br />
                <strong style={{ color: '#74505C' }}>{emailPhone}</strong>
              </p>

              <form onSubmit={handleVerify}>
                <div className="onyba-otp-inputs-row mb-4" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      className="onyba-otp-input-box"
                      maxLength={1}
                      placeholder="-"
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        border: '1px solid #e9ebe6',
                        backgroundColor: '#fcfcfb',
                        textAlign: 'center',
                        fontSize: '18px',
                        fontWeight: '500',
                        color: '#2d3129',
                        outline: 'none',
                        transition: 'border-color 0.3s, background-color 0.3s'
                      }}
                    />
                  ))}
                </div>

                <div className="d-flex flex-column gap-2">
                  <button
                    type="submit"
                    className="onyba-submit-btn border-0 w-100"
                    style={{
                      height: '50px',
                      borderRadius: '25px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: '#74505C',
                      color: 'white',
                      border: 'none',
                      boxShadow: '0px 3px 5.2px 0px rgba(0,0,0,0.25) inset'
                    }}
                    disabled={isVerifying}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>

                  <div className="mt-3" style={{ fontSize: '14px', color: '#6c757d' }}>
                    {timer > 0 ? (
                      <span>Resend code in <strong style={{ color: '#74505C' }}>{timer}s</strong></span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-link text-decoration-none p-0"
                        style={{ fontSize: '14px', color: '#74505C', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={handleResend}
                        disabled={isResending}
                      >
                        {isResending ? 'Resending...' : 'Resend Code'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
    </>
  )
}

export default OtpVerificationPopup
