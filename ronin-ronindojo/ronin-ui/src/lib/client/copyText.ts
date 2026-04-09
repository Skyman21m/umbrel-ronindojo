const COPY_ERR = "Unable to copy text. Please copy text manually";

export const copyText = async (text: string): Promise<void> => {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy text", error);
      throw COPY_ERR;
    }
  } else {
    const textarea = document.createElement("textarea");

    textarea.style.opacity = "0";
    textarea.style.position = "absolute";

    document.body.append(textarea);

    textarea.value = text;
    textarea.focus();
    textarea.select();

    try {
      const result = document.execCommand("copy");

      if (!result) {
        console.error("Failed to copy text");
        throw COPY_ERR;
      }
    } catch (error) {
      console.error("Failed to copy text", error);
      throw COPY_ERR;
    }

    textarea.remove();

    return;
  }
};
