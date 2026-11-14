package com.inventory.pos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import java.text.SimpleDateFormat
import java.util.*

// Data model matching the desktop inventory schema
data class InventoryItem(
    val id: String = "",
    val sku: String = "",
    val name: String = "",
    val category: String = "General",
    val quantity: Int = 0,
    val minQuantity: Int = 5,
    val unitCost: Double = 0.0,
    val retailPrice: Double = 0.0,
    val unit: String = "pcs",
    val barcode: String? = null,
    val location: String = "Store Floor",
    val notes: String = "",
    val updatedAt: String = ""
)

class MainActivity : ComponentActivity() {
    private val firestore = FirebaseFirestore.getInstance()
    private var listenerRegistration: ListenerRegistration? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF2563EB),
                    secondary = Color(0xFF10B981),
                    background = Color(0xFFF8FAFC),
                    surface = Color.White
                )
            ) {
                InventoryAndroidApp(firestore = firestore)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        listenerRegistration?.remove()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryAndroidApp(firestore: FirebaseFirestore) {
    var currentTab by remember { mutableStateOf(0) } // 0: Catalog, 1: Intake, 2: Scanner/Audit
    var itemsList by remember { mutableStateOf<List<InventoryItem>>(emptyList()) }
    var searchQuery by remember { mutableStateOf("") }
    var isConnected by remember { mutableStateOf(true) }

    // Real-time Firestore snapshot listener
    DisposableEffect(Unit) {
        val registration = firestore.collection("items")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    isConnected = false
                    return@addSnapshotListener
                }
                isConnected = true
                if (snapshot != null) {
                    val list = mutableListOf<InventoryItem>()
                    for (doc in snapshot.documents) {
                        val item = InventoryItem(
                            id = doc.id,
                            sku = doc.getString("sku") ?: "",
                            name = doc.getString("name") ?: "",
                            category = doc.getString("category") ?: "General",
                            quantity = (doc.getLong("quantity") ?: 0L).toInt(),
                            minQuantity = (doc.getLong("minQuantity") ?: 5L).toInt(),
                            unitCost = doc.getDouble("unitCost") ?: 0.0,
                            retailPrice = doc.getDouble("retailPrice") ?: 0.0,
                            unit = doc.getString("unit") ?: "pcs",
                            barcode = doc.getString("barcode"),
                            location = doc.getString("location") ?: "Store Floor",
                            notes = doc.getString("notes") ?: "",
                            updatedAt = doc.getString("updatedAt") ?: ""
                        )
                        list.add(item)
                    }
                    itemsList = list
                }
            }

        onDispose {
            registration.remove()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Inventory POS Mobile",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(
                                        if (isConnected) Color(0xFF10B981) else Color.Red,
                                        shape = RoundedCornerShape(3.dp)
                                    )
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (isConnected) "Firebase Live (${itemsList.size} items)" else "Offline",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp
            ) {
                NavigationBarItem(
                    selected = currentTab == 0,
                    onClick = { currentTab = 0 },
                    icon = { Icon(Icons.Default.List, contentDescription = "Catalog") },
                    label = { Text("Catalog") }
                )
                NavigationBarItem(
                    selected = currentTab == 1,
                    onClick = { currentTab = 1 },
                    icon = { Icon(Icons.Default.AddCircle, contentDescription = "Add Item") },
                    label = { Text("Intake") }
                )
                NavigationBarItem(
                    selected = currentTab == 2,
                    onClick = { currentTab = 2 },
                    icon = { Icon(Icons.Default.QrCodeScanner, contentDescription = "Audit / Scan") },
                    label = { Text("Stock Audit") }
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
            when (currentTab) {
                0 -> CatalogScreen(
                    items = itemsList.filter {
                        it.name.contains(searchQuery, ignoreCase = true) ||
                        it.sku.contains(searchQuery, ignoreCase = true) ||
                        (it.barcode?.contains(searchQuery) == true)
                    },
                    searchQuery = searchQuery,
                    onSearchQueryChange = { searchQuery = it },
                    onAdjustStock = { item, delta ->
                        val newQty = (item.quantity + delta).coerceAtLeast(0)
                        firestore.collection("items").document(item.id)
                            .update(mapOf("quantity" to newQty, "updatedAt" to getTimestamp()))
                    }
                )
                1 -> RemoteIntakeScreen(
                    onSaveItem = { newItem ->
                        val docId = "item_" + UUID.randomUUID().toString().substring(0, 8)
                        val data = hashMapOf(
                            "id" to docId,
                            "sku" to newItem.sku,
                            "name" to newItem.name,
                            "category" to newItem.category,
                            "quantity" to newItem.quantity,
                            "minQuantity" to newItem.minQuantity,
                            "unitCost" to newItem.unitCost,
                            "retailPrice" to newItem.retailPrice,
                            "unit" to newItem.unit,
                            "barcode" to (newItem.barcode ?: ""),
                            "location" to newItem.location,
                            "notes" to "Added via Android App",
                            "updatedAt" to getTimestamp()
                        )
                        firestore.collection("items").document(docId).set(data)
                        currentTab = 0 // Return to catalog
                    }
                )
                2 -> StockAuditScreen(
                    items = itemsList,
                    onUpdateQuantity = { item, newQty ->
                        firestore.collection("items").document(item.id)
                            .update(mapOf("quantity" to newQty, "updatedAt" to getTimestamp()))
                    }
                )
            }
        }
    }
}

@Composable
fun CatalogScreen(
    items: List<InventoryItem>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onAdjustStock: (InventoryItem, Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(12.dp)) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchQueryChange,
            placeholder = { Text("Search name, SKU, or barcode...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(10.dp))

        if (items.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No items found. Tap 'Intake' below to add items.", color = Color.Gray)
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(items, key = { it.id }) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(item.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text(
                                    "${item.sku} • ${item.category}",
                                    fontSize = 12.sp,
                                    color = Color.Gray
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        "Retail: $${String.format(Locale.US, "%.2f", item.retailPrice)}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF2563EB)
                                    )
                                    if (item.quantity <= item.minQuantity) {
                                        Text(
                                            "LOW STOCK",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFFEF4444)
                                        )
                                    }
                                }
                            }

                            // Quick adjust controls
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(onClick = { onAdjustStock(item, -1) }) {
                                    Icon(Icons.Default.RemoveCircleOutline, contentDescription = "Minus", tint = Color.Gray)
                                }
                                Text(
                                    "${item.quantity} ${item.unit}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                IconButton(onClick = { onAdjustStock(item, 1) }) {
                                    Icon(Icons.Default.AddCircleOutline, contentDescription = "Add", tint = Color(0xFF2563EB))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RemoteIntakeScreen(onSaveItem: (InventoryItem) -> Unit) {
    var name by remember { mutableStateOf("") }
    var sku by remember { mutableStateOf("SKU-${(1000..9999).random()}") }
    var category by remember { mutableStateOf("General") }
    var quantity by remember { mutableStateOf("10") }
    var unitCost by remember { mutableStateOf("15.00") }
    var retailPrice by remember { mutableStateOf("25.00") }
    var barcode by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("pcs") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "Remote Mobile Stock Intake",
            fontWeight = FontWeight.Bold,
            fontSize = 17.sp
        )
        Text(
            text = "Items uploaded here sync directly to the desktop POS in real time.",
            fontSize = 12.sp,
            color = Color.Gray
        )

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Product Name *") },
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = sku,
                onValueChange = { sku = it },
                label = { Text("SKU") },
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = category,
                onValueChange = { category = it },
                label = { Text("Category") },
                modifier = Modifier.weight(1f)
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = quantity,
                onValueChange = { quantity = it },
                label = { Text("Quantity") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = unit,
                onValueChange = { unit = it },
                label = { Text("Unit (pcs, box)") },
                modifier = Modifier.weight(1f)
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = unitCost,
                onValueChange = { unitCost = it },
                label = { Text("Cost Price ($)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = retailPrice,
                onValueChange = { retailPrice = it },
                label = { Text("Retail Price ($)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f)
            )
        }

        OutlinedTextField(
            value = barcode,
            onValueChange = { barcode = it },
            label = { Text("Barcode / EAN (Optional)") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))

        Button(
            onClick = {
                if (name.isNotBlank()) {
                    val newItem = InventoryItem(
                        sku = sku.ifBlank { "SKU-${(1000..9999).random()}" },
                        name = name.trim(),
                        category = category.ifBlank { "General" },
                        quantity = quantity.toIntOrNull() ?: 0,
                        unitCost = unitCost.toDoubleOrNull() ?: 0.0,
                        retailPrice = retailPrice.toDoubleOrNull() ?: 0.0,
                        barcode = barcode.ifBlank { null },
                        unit = unit.ifBlank { "pcs" }
                    )
                    onSaveItem(newItem)
                }
            },
            enabled = name.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
        ) {
            Icon(Icons.Default.CloudUpload, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Push Remotely to Inventory")
        }
    }
}

@Composable
fun StockAuditScreen(
    items: List<InventoryItem>,
    onUpdateQuantity: (InventoryItem, Int) -> Unit
) {
    var filterQuery by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(12.dp)) {
        Text("Stock-Take & Physical Audit", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Text("Quickly verify on-hand floor stock against inventory ledger.", fontSize = 12.sp, color = Color.Gray)
        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = filterQuery,
            onValueChange = { filterQuery = it },
            placeholder = { Text("Scan or search item to count...") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val filtered = items.filter { it.name.contains(filterQuery, ignoreCase = true) || it.sku.contains(filterQuery, ignoreCase = true) }
            items(filtered, key = { it.id }) { item ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(item.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text("SKU: ${item.sku}", fontSize = 11.sp, color = Color.Gray)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Button(
                                onClick = { onUpdateQuantity(item, (item.quantity - 1).coerceAtLeast(0)) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) { Text("-1") }
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("${item.quantity}", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.width(6.dp))
                            Button(
                                onClick = { onUpdateQuantity(item, item.quantity + 1) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) { Text("+1") }
                        }
                    }
                }
            }
        }
    }
}

fun getTimestamp(): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    sdf.timeZone = TimeZone.getTimeZone("UTC")
    return sdf.format(Date())
}
