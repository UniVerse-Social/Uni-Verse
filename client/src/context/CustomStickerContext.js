import React, { createContext, useContext, useMemo } from 'react';
import useCustomStickers from '../hooks/useCustomStickers';

const CustomStickerContext = createContext({
  customStickers: [],
  addStickerFromImage: async () => {},
  addStickerFromPlacement: () => {},
  removeCustomSticker: () => {},
});

export const CustomStickerProvider = ({ user, children }) => {
  const {
    customStickers,
    addStickerFromImage,
    addStickerFromPlacement,
    removeCustomSticker,
  } = useCustomStickers(user);
  const memoValue = useMemo(
    () => ({
      customStickers,
      addStickerFromImage,
      addStickerFromPlacement,
      removeCustomSticker,
    }),
    [customStickers, addStickerFromImage, addStickerFromPlacement, removeCustomSticker]
  );

  return <CustomStickerContext.Provider value={memoValue}>{children}</CustomStickerContext.Provider>;
};

export const useCustomStickerCatalog = () => useContext(CustomStickerContext);

export default CustomStickerContext;