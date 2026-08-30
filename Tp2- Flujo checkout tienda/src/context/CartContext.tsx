import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItemType {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUri: string;
  selectedColor: string;
  selectedSize: string;
  quantity: number;
  availableColors: string[];
  availableSizes: string[];
}

interface CartContextData {
  items: CartItemType[];
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  updateColor: (id: string, color: string) => void;
  updateSize: (id: string, size: string) => void;
  totalAmount: number;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItemType[]>([
    {
      id: '1',
      name: 'NikeCourt Lite 2',
      price: 67.00,
      imageUri: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
      selectedColor: 'Blue',
      selectedSize: '38 EU',
      quantity: 1,
      availableColors: ['Blue', 'Red', 'Black', 'White'],
      availableSizes: ['38 EU', '39 EU', '40 EU', '41 EU']
    },
    {
      id: '2',
      name: 'Wilson Hammer 5.3',
      price: 80.45,
      originalPrice: 99.95,
      imageUri: 'https://m.media-amazon.com/images/I/61kM5+9f1VL._AC_SL1500_.jpg',
      selectedColor: 'Black',
      selectedSize: '2 -1/4',
      quantity: 1,
      availableColors: ['Black', 'Silver', 'Yellow'],
      availableSizes: ['2 -1/4', '3', '4']
    }
  ]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const updateColor = (id: string, color: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selectedColor: color } : item))
    );
  };

  const updateSize = (id: string, size: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selectedSize: size } : item))
    );
  };

  const totalAmount = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        removeItem,
        updateQuantity,
        updateColor,
        updateSize,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
