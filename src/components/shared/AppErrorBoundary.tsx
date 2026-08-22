import React, { ErrorInfo, ReactNode } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";
import { NETWORK_ERROR_MESSAGE } from "../../utils/errorMessage";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<
  Props,
  State
> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("Unhandled UI error", error, info);
    }
  }

  private retry = () => {
    this.setState({
      hasError: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Không thể tải nội dung</Text>
          <Text style={styles.message}>{NETWORK_ERROR_MESSAGE}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.retry}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    minWidth: 120,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
