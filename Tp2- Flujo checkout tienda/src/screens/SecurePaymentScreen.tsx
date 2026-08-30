import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, FlatList, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { usePayment, CardType } from '../context/PaymentContext';

export default function SecurePaymentScreen() {
  const navigation = useNavigation();
  const { totalAmount, items } = useCart();
  const { paymentDetails, updatePaymentField, isValid } = usePayment();
  const [dateError, setDateError] = useState('');

  const handlePayNow = () => {
    if (isValid) {
      alert('Pago procesado correctamente!');
      navigation.goBack();
    }
  };

  const CardTypeOption = ({ type, label, icon }: { type: CardType, label: string, icon: any }) => (
    <TouchableOpacity 
      style={[
        styles.cardTypeBtn, 
        paymentDetails.cardType === type && styles.cardTypeBtnActive
      ]}
      onPress={() => updatePaymentField('cardType', type)}
    >
      <FontAwesome 
        name={icon} 
        size={24} 
        color={paymentDetails.cardType === type ? '#2F80ED' : '#666'} 
        style={{ marginBottom: 4 }}
      />
      <Text style={[
        styles.cardTypeText,
        paymentDetails.cardType === type && styles.cardTypeTextActive
      ]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#2F80ED" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <View style={styles.secureBadgeHeader}>
          <Ionicons name="shield-checkmark" size={16} color="#2E7D32" />
          <View style={{ marginLeft: 4 }}>
            <Text style={styles.secureTextHeader}>SECURE</Text>
            <Text style={styles.secureSubtextHeader}>SSL ENCRYPTION</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Shipping Section */}
        <Text style={styles.sectionTitle}>Shipping</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.shippingBtn}>
            <Ionicons name="bus-outline" size={24} color="#333" />
            <Text style={styles.shippingBtnText}>Add Address</Text>
            <Ionicons name="chevron-forward" size={20} color="#2F80ED" />
          </TouchableOpacity>
        </View>

        {/* Payment Section */}
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.section}>
          <View style={styles.paymentHeader}>
            <Ionicons name="card-outline" size={24} color="#333" />
            <Text style={styles.paymentHeaderText}>Add Credit / Debit Card</Text>
          </View>

          <View style={styles.cardTypeRow}>
            <CardTypeOption type="Visa" label="Visa" icon="cc-visa" />
            <CardTypeOption type="MasterCard" label="MasterCard" icon="cc-mastercard" />
            <CardTypeOption type="Otra" label="Otras" icon="credit-card" />
          </View>

          <TextInput 
            style={styles.input} 
            placeholder="Card Holder's Name"
            value={paymentDetails.cardHolderName}
            onChangeText={(txt) => updatePaymentField('cardHolderName', txt)}
          />

          <TextInput 
            style={styles.input} 
            placeholder="Card Number"
            keyboardType="number-pad"
            value={paymentDetails.cardNumber}
            maxLength={19}
            onChangeText={(txt) => {
              const cleaned = txt.replace(/\D/g, '');
              const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || '';
              updatePaymentField('cardNumber', formatted);
            }}
          />

          <Text style={styles.label}>Expire Date</Text>
          <TextInput 
            style={[styles.input, dateError ? { borderColor: 'red' } : {}]} 
            placeholder="MM/YY"
            keyboardType="number-pad"
            maxLength={5}
            value={paymentDetails.expireDate}
            onChangeText={(txt) => {
              const cleaned = txt.replace(/\D/g, '');
              setDateError('');
              
              if (cleaned.length >= 2) {
                const month = parseInt(cleaned.slice(0, 2), 10);
                if (month > 12 || month < 1) {
                  setDateError('Mes inválido (01 - 12)');
                }
              }
              
              if (cleaned.length >= 4) {
                const year = parseInt(cleaned.slice(2, 4), 10);
                if (year > 0 && year < 26) {
                  setDateError('Año vencido (mín 26)');
                }
              }

              if (cleaned.length >= 3) {
                updatePaymentField('expireDate', `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
              } else {
                updatePaymentField('expireDate', cleaned);
              }
            }}
          />
          {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}

          <Text style={styles.label}>Security Code</Text>
          <View style={[styles.input, styles.securityCodeContainer]}>
            <TextInput 
              style={{ flex: 1 }}
              placeholder="000"
              keyboardType="number-pad"
              secureTextEntry
              value={paymentDetails.cvv}
              onChangeText={(txt) => updatePaymentField('cvv', txt)}
              maxLength={3}
            />
            <Ionicons name="information-circle-outline" size={20} color="#2F80ED" />
          </View>
        </View>

        {/* Carousel Section */}
        <View style={styles.carouselHeader}>
          <Text style={styles.itemsCount}>{items.length} items</Text>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Arrives by April 3 to April 9th</Text>
          </View>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.carouselContainer}
          snapToInterval={316} // card width + margin
          decelerationRate="fast"
          renderItem={({ item }) => (
            <View style={styles.carouselCard}>
              <Image source={{ uri: item.imageUri }} style={styles.carouselImage} />
              <View style={styles.carouselDetails}>
                <Text style={styles.carouselName}>{item.name}</Text>
                <Text style={styles.carouselOption}>Color: {item.selectedColor}</Text>
                <Text style={styles.carouselOption}>Size: {item.selectedSize}</Text>
                <View style={styles.carouselQtyPrice}>
                  <Text style={styles.carouselQty}>Qty: {item.quantity}</Text>
                  <Text style={styles.carouselPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
        />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerTopRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-up" size={16} color="#2F80ED" />
              <Text style={styles.totalLabel}>Total</Text>
            </View>
            <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.payBtn, !isValid && styles.payBtnDisabled]} 
            onPress={handlePayNow}
            disabled={!isValid}
          >
            <Text style={styles.payBtnText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.termsText}>
          This is the final step, after you touching <Text style={{fontWeight: 'bold'}}>Pay Now</Text> button, the payment will be transaction
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  secureBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secureTextHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
  },
  secureSubtextHeader: {
    fontSize: 6,
    color: '#666',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 150,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  shippingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
  },
  shippingBtnText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentHeaderText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  cardTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTypeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#FAFAFA',
  },
  cardTypeBtnActive: {
    borderColor: '#2F80ED',
    backgroundColor: '#F0F6FF',
  },
  cardTypeText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  cardTypeTextActive: {
    color: '#2F80ED',
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  securityCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '50%',
  },
  carouselHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  itemsCount: {
    fontSize: 12,
    color: '#333',
  },
  banner: {
    backgroundColor: '#FFF9D2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  bannerText: {
    fontSize: 10,
    color: '#666',
  },
  carouselContainer: {
    paddingRight: 16,
  },
  carouselCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginRight: 16,
    flexDirection: 'row',
    width: 300,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  carouselImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  carouselDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  carouselName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  carouselOption: {
    fontSize: 12,
    color: '#666',
  },
  carouselQtyPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  carouselQty: {
    fontSize: 12,
    color: '#666',
  },
  carouselPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 2,
  },
  payBtn: {
    backgroundColor: '#2F80ED',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  payBtnDisabled: {
    opacity: 0.5,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    color: '#999',
    fontSize: 10,
    lineHeight: 14,
  },
});
