import React, { FC, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

import { encryptString } from "../../lib/client/encryptString";
import { client } from "../../apiClient";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { SuccessMessage } from "../SuccessMessage";
import { ErrorMessage } from "../ErrorMessage";
import { LinearLoader } from "../LinearLoader";

interface FormData {
  currentPassword: string;
  newPassword: string;
  repeatNewPassword: string;
}

export const ChangePassword: FC = () => {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState<boolean>(false);

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const encrypted = await encryptString(
        JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          repeatNewPassword: data.repeatNewPassword,
        }),
      );

      await client.post("/auth/change-password", encrypted, { headers: { "Content-Type": "text/plain" } });

      setSuccess("Password has been changed successfully");
      reset();
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    }
  };

  useEffect(() => {
    if (isSubmitting) {
      setError(null);
      setSuccess(null);
    }
  }, [isSubmitting]);

  return (
    <div className="box bg-surface">
      <h2 className="text-white font-primary text-xl mb-3">Change Password</h2>
      <p className="text-paragraph mb-12">Use the form below to change your user password for RoninDojo.</p>
      <div className="">
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
          <div className="w-full mb-8">
            <input
              type="password"
              placeholder="Current Password"
              className="block px-4 py-3 rounded-full bg-border text-paragraph text-lg w-full border-none focus:ring-primary transition"
              autoComplete="current-password"
              {...register("currentPassword", { required: true })}
            />
          </div>
          <div className="w-full relative mb-8">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password - Minimum 8 characters"
              className="block px-4 pr-12 py-3 rounded-full bg-border text-paragraph text-lg w-full border-none focus:ring-primary transition"
              autoComplete="new-password"
              {...register("newPassword", {
                required: true,
                minLength: 8,
                validate: {
                  sameAsOldPassword: (val) => getValues().currentPassword !== val,
                  characters: (val) => /^\w*$/g.test(val),
                },
              })}
            />
            {showPassword ? (
              <EyeSlashIcon
                onClick={() => setShowPassword(false)}
                className="absolute top-3 right-3 h-7 w-7 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
              />
            ) : (
              <EyeIcon
                onClick={() => setShowPassword(true)}
                className="absolute top-3 right-3 h-7 w-7 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
              />
            )}
          </div>
          <div className="w-full relative mb-8">
            <input
              type={showPasswordRepeat ? "text" : "password"}
              placeholder="Confirm New Password"
              className="block px-4 pr-12 py-3 rounded-full bg-border text-paragraph text-lg w-full border-none focus:ring-primary transition"
              {...register("repeatNewPassword", {
                required: true,
                validate: { samePassword: (val) => getValues().newPassword === val },
              })}
            />
            {showPasswordRepeat ? (
              <EyeSlashIcon
                onClick={() => setShowPasswordRepeat(false)}
                className="absolute top-3 right-3 h-7 w-7 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
              />
            ) : (
              <EyeIcon
                onClick={() => setShowPasswordRepeat(true)}
                className="absolute top-3 right-3 h-7 w-7 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
              />
            )}
          </div>
          <div className="mb-8">
            <button type="submit" disabled={isSubmitting} className="button">
              Change Password
            </button>
          </div>
        </form>
        <div className="col-span-2">
          <SuccessMessage message={success} />

          {isSubmitting && <LinearLoader />}

          <ErrorMessage
            errors={[
              error,
              errors.currentPassword?.type === "required" ? "Current password is required" : null,
              errors.newPassword?.type === "required" ? "New password is required" : null,
              errors.newPassword?.type === "minLength" ? "New password needs to be at least 8 characters long" : null,
              errors.newPassword?.type === "sameAsOldPassword" ? "New password has to be different than your old password" : null,
              errors.newPassword?.type === "characters" ? "Password must contain only letters and digits" : null,
              errors.repeatNewPassword?.type === "required" ? "New password confirmation is required" : null,
              errors.repeatNewPassword?.type === "samePassword" ? "New passwords do not match" : null,
            ]}
          />
        </div>
      </div>
    </div>
  );
};
