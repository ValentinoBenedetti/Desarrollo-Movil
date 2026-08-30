import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, Modal, FlatList, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItemType, useCart } from '../context/CartContext';

interface Props {
  item: CartItemType;
}

export const CartItem: React.FC<Props> = ({ item }) => {
  const { updateQuantity, removeItem, updateColor, updateSize } = useCart();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'color' | 'size' | null>(null);

  const handleDecrease = () => {
    if (item.quantity === 1) {
      Alert.alert(
        "Eliminar Producto",
        "¿Estás seguro que deseas eliminar este producto del carrito?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: () => removeItem(item.id) }
        ]
      );
    } else {
      updateQuantity(item.id, -1);
    }
  };

  const handleIncrease = () => {
    updateQuantity(item.id, 1);
  };

  const openModal = (type: 'color' | 'size') => {
    setModalType(type);
    setModalVisible(true);
  };

  const selectOption = (option: string) => {
    if (modalType === 'color') {
      updateColor(item.id, option);
    } else if (modalType === 'size') {
      updateSize(item.id, option);
    }
    setModalVisible(false);
  };

  const optionsData = modalType === 'color' ? item.availableColors : item.availableSizes;

  return (
    <>
      <View style={styles.card}>
        <Image source={{ uri: item.imageUri }} style={styles.image} />
        
        <View style={styles.details}>
          <Text style={styles.name}>{item.name}</Text>
          
          <View style={styles.priceRow}>
            {item.originalPrice && (
              <Text style={styles.originalPrice}>${item.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity onPress={() => openModal('color')} style={styles.optionBtn}>
              <Text style={styles.optionLabel}>Color: </Text>
              <Text style={styles.optionValue}>{item.selectedColor}</Text>
              <Ionicons name="chevron-down" size={14} color="gray" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => openModal('size')} style={styles.optionBtn}>
              <Text style={styles.optionLabel}>Size: </Text>
              <Text style={styles.optionValue}>{item.selectedSize}</Text>
              <Ionicons name="chevron-down" size={14} color="gray" />
            </TouchableOpacity>
          </View>

          <View style={styles.qtyContainer}>
            <TouchableOpacity onPress={handleDecrease} style={styles.qtyBtn}>
              <Ionicons 
                name={item.quantity === 1 ? "trash-outline" : "remove-outline"} 
                size={18} 
                color={item.quantity === 1 ? "#FF3B30" : "black"} 
              />
            </TouchableOpacity>
            
            <Text style={styles.qtyText}>{item.quantity}</Text>
            
            <TouchableOpacity onPress={handleIncrease} style={styles.qtyBtn}>
              <Ionicons name="add-outline" size={18} color="black" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Sheet Modal for Selection */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Seleccionar {modalType === 'color' ? 'Color' : 'Talle'}
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                <FlatList
                  data={optionsData}
                  keyExtractor={(opt) => opt}
                  renderItem={({ item: opt }) => (
                    <TouchableOpacity 
                      style={styles.modalOption}
                      onPress={() => selectOption(opt)}
                    >
                      <Text style={[
                        styles.modalOptionText,
                        (modalType === 'color' ? item.selectedColor : item.selectedSize) === opt && styles.modalOptionTextSelected
                      ]}>
                        {opt}
                      </Text>
                      {(modalType === 'color' ? item.selectedColor : item.selectedSize) === opt && (
                        <Ionicons name="checkmark" size={20} color="#2F80ED" />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  details: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  optionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 12,
    color: '#666',
  },
  optionValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginRight: 2,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#F6F7F9',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#2F80ED',
    fontWeight: 'bold',
  },
});
