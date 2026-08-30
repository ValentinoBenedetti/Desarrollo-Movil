import React, { createContext, useContext, useState, ReactNode } from 'react';

export type CardType = 'Visa' | 'MasterCard' | 'Otra';

export interface PaymentDetails {
  cardType: CardType;
  cardHolderName: string;
  cardNumber: string;
  expireDate: string;
  cvv: string;
  saveCard: boolean;
}

interface PaymentContextData {
  paymentDetails: PaymentDetails;
  updatePaymentField: (field: keyof PaymentDetails, value: any) => void;
  isValid: boolean;
}

const PaymentContext = createContext<PaymentContextData>({} as PaymentContextData);

export const usePayment = () => useContext(PaymentContext);

export const PaymentProvider = ({ children }: { children: ReactNode }) => {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    cardType: 'Visa',
    cardHolderName: '',
    cardNumber: '',
    expireDate: '',
    cvv: '',
    saveCard: true,
  });

  const updatePaymentField = (field: keyof PaymentDetails, value: any) => {
    setPaymentDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isValid = (() => {
    if (paymentDetails.cardHolderName.trim().length === 0) return false;
    if (paymentDetails.cardNumber.replace(/\s/g, '').length < 15) return false;
    if (paymentDetails.cvv.length < 3) return false;
    
    const parts = paymentDetails.expireDate.split('/');
    if (parts.length !== 2) return false;
    
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    
    if (isNaN(month) || month < 1 || month > 12) return false;
    if (isNaN(year) || year < 26) return false;
    
    return true;
  })();

  return (
    <PaymentContext.Provider
      value={{
        paymentDetails,
        updatePaymentField,
        isValid,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
};
